import { expect, test } from "bun:test";
import { templating as registration } from "../../../src/concepts/templating/registry.ts";
import {
  InvalidTrustedPath,
  InvalidTemplateOrigin,
  InvalidTrustedValue,
  RecursiveTemplate,
  TemplateFailed,
  TemplateNotFound,
  TemplateNameTaken,
  TemplateSyntax,
  TemplatingConcept,
  type TrustedPath,
  UndefinedVariable,
  UnsupportedTemplate,
  UsedTemplateNotFound,
} from "../../../src/concepts/templating/templating.ts";

const TRUSTED_COLLECTION_EXCERPTS = { wildcard: ["collections", "*", "*", "excerpt"] } as const;

type ErrorClass<T extends Error> = abstract new (...args: never[]) => T;

function thrown<T extends Error>(run: () => unknown, errorClass: ErrorClass<T>): T {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(errorClass);
    return error as T;
  }
  throw new Error(`Expected ${errorClass.name}.`);
}

test("its principle: named fragments produce escaped HTML with explicit trusted content", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "masthead.html", source: "<header>{{ site.title }}</header>" });
  templating.define({ name: "card.html", source: "<p>{{ item.title }} / {{ collections.posts.size }}</p>" });
  const page = templating.define({
    name: "page.html",
    source:
      '{% render "masthead.html" %}<main>{{ page.content }}{% render "card.html", item: page.data %}</main>',
  });
  const context = {
    collections: { posts: [{ title: "One" }] },
    page: { content: "<article>Trusted</article>", data: { title: "Compiler <Design>" } },
    site: { title: "Ada & Bob" },
  };

  expect(templating._uses({ owner: page.template })).toEqual([
    { used: "masthead.html" },
    { used: "card.html" },
  ]);
  expect(templating._tree({ owner: page.template })).toEqual([
    { used: "masthead.html" },
    { used: "card.html" },
  ]);
  expect(templating._reads({ owner: page.template })).toEqual([
    { path: ["collections", "posts", "size"] },
    { path: ["page", "content"] },
    { path: ["page", "data"] },
    { path: ["site", "title"] },
  ]);

  const rendered = templating.renderTemplate({
    template: page.template,
    subject: "event",
    context,
    trusted: [["page", "content"]],
  });
  expect(rendered.output).toBe(
    "<header>Ada &amp; Bob</header><main><article>Trusted</article><p>Compiler &lt;Design&gt; / 1</p></main>",
  );
  expect(templating._tree({ owner: rendered.rendering })).toEqual(templating._tree({ owner: page.template }));
  expect(templating._reads({ owner: rendered.rendering })).toEqual(templating._reads({ owner: page.template }));
});

test("literal nested render dependencies and partial reads are transitive", () => {
  const templating = new TemplatingConcept();
  const leaf = templating.define({ name: "leaf", source: "{{ site.owner }}" });
  const middle = templating.define({ name: "middle", source: '{% render "leaf" %}{{ collections.news.size }}' });
  const root = templating.define({
    name: "root",
    source: '{% render "middle" %}{% render "leaf" %}{{ page.data.title }}',
  });

  expect(templating._uses({ owner: root.template })).toEqual([
    { used: "middle" },
    { used: "leaf" },
  ]);
  expect(templating._tree({ owner: root.template })).toEqual([
    { used: "middle" },
    { used: "leaf" },
  ]);
  expect(templating._usedBy({ name: "leaf" })).toEqual([
    { owner: root.template },
    { owner: middle.template },
  ]);
  expect(templating._reads({ owner: root.template })).toEqual([
    { path: ["collections", "news", "size"] },
    { path: ["page", "data", "title"] },
    { path: ["site", "owner"] },
  ]);
  expect(templating._reads({ owner: leaf.template })).toEqual([{ path: ["site", "owner"] }]);
});

test("render arguments are isolated locals and contribute their caller reads", () => {
  const templating = new TemplatingConcept();
  const card = templating.define({ name: "card", source: "{{ item.title }}|{{ site.title }}" });
  const page = templating.define({
    name: "page",
    source: '{% assign local = page.data %}{% render "card", item: local %}',
  });

  expect(templating._reads({ owner: card.template })).toEqual([
    { path: ["item", "title"] },
    { path: ["site", "title"] },
  ]);
  expect(templating._reads({ owner: page.template })).toEqual([
    { path: ["page", "data"] },
    { path: ["site", "title"] },
  ]);
  expect(
    templating.renderTemplate({
      template: page.template,
      subject: "page",
      context: { page: { data: { title: "Local" } }, site: { title: "Global" } },
      trusted: [],
    }).output,
  ).toBe("Local|Global");
});

test("unsupported dependency and escaping constructs are rejected at definition", () => {
  const sources = [
    ['{% include "partial" %}', "include tag"],
    ['{% layout "frame" %}', "layout tag"],
    ['{% cycle page.content, "other" %}', "cycle tag"],
    ["{% render partial %}", "quoted literal"],
    ['{% render "card-{{ kind }}" %}', "quoted literal"],
    ['{% render "card" with page.data as item %}', "with/for"],
    ['{% render "card" for page.items as item %}', "with/for"],
    ['{% render "card", item %}', "named key"],
    ['{% render "card", item = page.data %}', "named key"],
    ['{% render "card", __proto__: page.data %}', "safe named key"],
    ['{% render "../card" %}', "nonempty"],
    ["{{ collections[which].size }}", "Dynamic context"],
    ["{% assign item = page.data %}{{ item[which] }}", "Dynamic context"],
  ] as const;

  for (const [source, detail] of sources) {
    const error = thrown(
      () => new TemplatingConcept().define({ name: "unsupported", source: `line one\n${source}` }),
      UnsupportedTemplate,
    );
    expect(error.feature).toContain(detail);
    expect(error.templateName).toBe("unsupported");
    expect(error.line).toBe(2);
    expect(error.column).toBeGreaterThan(0);
  }
});

test("literal bracket paths and literal raw blocks remain supported", () => {
  const templating = new TemplatingConcept();
  const template = templating.define({
    name: "literal",
    source: '{% raw %}{% include "not-executed" %}{% endraw %}{{ collections["posts"][0].title }}',
  });
  expect(templating._reads({ owner: template.template })).toEqual([
    { path: ["collections", "posts", "0", "title"] },
  ]);
  expect(
    templating.renderTemplate({
      template: template.template,
      subject: "literal",
      context: { collections: { posts: [{ title: "Safe <Title>" }] } },
      trusted: [],
    }).output,
  ).toBe('{% include "not-executed" %}Safe &lt;Title&gt;');
});

test("syntax errors preserve their source location and do not replace a definition", () => {
  const templating = new TemplatingConcept();
  const original = templating.define({ name: "page", source: "original" });
  const before = templating._template({ name: "page" });
  const unclosed = thrown(() => templating.define({ name: "page", source: "first\n{% if page.title %}" }), TemplateSyntax);
  expect(unclosed.templateName).toBe("page");
  expect(unclosed.line).toBe(2);
  expect(unclosed.column).toBe(1);
  expect(unclosed.detail).toContain("not closed");
  expect(templating._template({ name: "page" })).toEqual(before);
  expect(
    templating.renderTemplate({ template: original.template, subject: "still-valid", context: {}, trusted: [] }).output,
  ).toBe("original");

  const filter = thrown(() => templating.define({ name: "filter", source: "{{ value | not_a_filter }}" }), TemplateSyntax);
  expect(filter.detail).toContain("undefined filter");
});

test("direct and transitive missing templates are classified and located", () => {
  const templating = new TemplatingConcept();
  const direct = templating.define({ name: "direct", source: "first\n{% render \"missing\" %}" });
  const directError = thrown(
    () => templating.renderTemplate({ template: direct.template, subject: "direct", context: {}, trusted: [] }),
    UsedTemplateNotFound,
  );
  expect(directError.used).toBe("missing");
  expect(directError.referencedBy).toBe("direct");
  expect(directError.templateName).toBe("direct");
  expect(directError.line).toBe(2);

  templating.define({ name: "middle", source: "one\ntwo\n{% render \"nested-missing\" %}" });
  const root = templating.define({ name: "root", source: '{% render "middle" %}' });
  const nestedError = thrown(
    () => templating.renderTemplate({ template: root.template, subject: "root", context: {}, trusted: [] }),
    UsedTemplateNotFound,
  );
  expect(nestedError.used).toBe("nested-missing");
  expect(nestedError.referencedBy).toBe("middle");
  expect(nestedError.templateName).toBe("middle");
  expect(nestedError.line).toBe(3);

  const fillError = thrown(
    () => templating.renderSource({ subject: "body", source: '{% render "body-missing" %}', context: {}, trusted: [] }),
    UsedTemplateNotFound,
  );
  expect(fillError.used).toBe("body-missing");
  expect(fillError.templateName).toBeUndefined();
});

test("renderTemplate and renderSource reject self and nested literal cycles before evaluation", () => {
  const selfTemplating = new TemplatingConcept();
  const self = selfTemplating.define({ name: "self", source: 'first\n{% render "self" %}' });
  const selfError = thrown(
    () => selfTemplating.renderTemplate({ template: self.template, subject: "self", context: {}, trusted: [] }),
    RecursiveTemplate,
  );
  expect(selfError.cycle).toEqual(["self", "self"]);
  expect(selfError.templateName).toBe("self");
  expect(selfError.line).toBe(2);

  const templating = new TemplatingConcept();
  templating.define({ name: "a", source: '{% render "b" %}' });
  templating.define({ name: "b", source: 'first\n{% render "a" %}' });
  const fillError = thrown(
    () => templating.renderSource({ subject: "body", source: '{% render "a" %}', context: {}, trusted: [] }),
    RecursiveTemplate,
  );
  expect(fillError.cycle).toEqual(["a", "b", "a"]);
  expect(fillError.templateName).toBe("b");
  expect(fillError.line).toBe(2);
});

test("ordinary values escape and only explicit trusted string paths bypass escaping", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "trusted-argument", source: "{{ value }}" });
  const context = {
    ordinary: `<>&"'`,
    page: { content: "<strong>Trusted & authored</strong>" },
  };
  const source = [
    "{{ ordinary }}",
    '{{ ordinary | raw }}',
    '{{ page["content"] }}',
    '{{ page.content | raw }}',
    "{% assign alias = page.content %}{{ alias }}",
    '{{ page.content | append: "!" }}',
    '{{ page.content | default: "fallback" }}',
    "{% capture captured %}{{ page.content }}{% endcapture %}{{ captured }}",
    '{% render "trusted-argument", value: page.content %}',
  ].join("|");
  const output = templating.renderSource({
    subject: "trust",
    source,
    context,
    trusted: [["page", "content"]],
  }).output;

  expect(output).toBe(
    [
      "&lt;&gt;&amp;&#34;&#39;",
      "&lt;&gt;&amp;&#34;&#39;",
      "<strong>Trusted & authored</strong>",
      "&lt;strong&gt;Trusted &amp; authored&lt;/strong&gt;",
      "<strong>Trusted & authored</strong>",
      "&lt;strong&gt;Trusted &amp; authored&lt;/strong&gt;!",
      "&lt;strong&gt;Trusted &amp; authored&lt;/strong&gt;",
      "&lt;strong&gt;Trusted &amp; authored&lt;/strong&gt;",
      "<strong>Trusted & authored</strong>",
    ].join("|"),
  );
  expect(context.page.content).toBe("<strong>Trusted & authored</strong>");
  expect(typeof context.page.content).toBe("string");
});

test("trusted paths use literal segments and validate shape, existence, and value", () => {
  const templating = new TemplatingConcept();
  const context = { data: { "a.b": { "": "<i>literal path</i>" }, count: 1 } };
  expect(
    templating.renderSource({
      subject: "literal-path",
      source: '{{ data["a.b"][""] }}',
      context,
      trusted: [["data", "a.b", ""]],
    }).output,
  ).toBe("<i>literal path</i>");

  const invalidPath = thrown(
    () => templating.renderSource({ subject: "invalid", source: "", context, trusted: [[]] }),
    InvalidTrustedPath,
  );
  expect(invalidPath.index).toBe(0);
  expect(
    thrown(
      () => templating.renderSource({ subject: "missing", source: "", context, trusted: [["data", "missing"]] }),
      InvalidTrustedValue,
    ).path,
  ).toEqual(["data", "missing"]);
  expect(
    thrown(
      () => templating.renderSource({ subject: "number", source: "", context, trusted: [["data", "count"]] }),
      InvalidTrustedValue,
    ).path,
  ).toEqual(["data", "count"]);
});

test("the collection excerpt capability trusts only rich collection excerpts", () => {
  const templating = new TemplatingConcept();
  const collections = {
    notes: [{ excerpt: "<em>Note</em>", title: "Note <Three>" }],
    posts: [
      { body: "<script>body</script>", excerpt: "<p>First & foremost</p>", title: "Post <One>" },
      { body: "<aside>body</aside>", title: "Post <Two>" },
    ],
  };
  Object.defineProperty(collections, "__proto__", { enumerable: true, value: [{ excerpt: "<strong>Proto</strong>" }] });
  const context = { collections };
  const template = templating.define({
    name: "collection-excerpts",
    source:
      '{% for card in collections.posts %}{{ card.title }}|{% if card.excerpt %}{{ card.excerpt }}{% else %}none{% endif %}|{{ card.body }};{% endfor %}{% for card in collections.notes %}{{ card.excerpt }};{% endfor %}{% for card in collections["__proto__"] %}{{ card.excerpt }};{% endfor %}',
  });
  const output = templating.renderTemplate({
    template: template.template,
    subject: "collection-excerpts",
    context,
    trusted: [TRUSTED_COLLECTION_EXCERPTS],
  }).output;

  expect(output).toBe(
    "Post &lt;One&gt;|<p>First & foremost</p>|&lt;script&gt;body&lt;/script&gt;;Post &lt;Two&gt;|none|&lt;aside&gt;body&lt;/aside&gt;;<em>Note</em>;<strong>Proto</strong>;",
  );
  expect(context.collections.posts[0]!.excerpt).toBe("<p>First & foremost</p>");

  const literalStars = { collections: { "*": { "*": { excerpt: "<i>literal stars</i>" } } } };
  expect(
    templating.renderSource({
      subject: "literal-stars",
      source: '{{ collections["*"]["*"].excerpt }}',
      context: literalStars,
      trusted: [["collections", "*", "*", "excerpt"]],
    }).output,
  ).toBe("<i>literal stars</i>");
});

test("wildcard trust rejects malformed declarations and unsafe matched values", () => {
  const templating = new TemplatingConcept();
  const context = { collections: { posts: [{ excerpt: "<p>Excerpt</p>" }] } };
  const inherited = Object.create({ wildcard: ["collections", "*", "*", "excerpt"] });
  const declarations = [
    { wildcard: ["collections"] },
    { wildcard: [] },
    { wildcard: ["collections", "*", "*", "excerpt"], extra: true },
    inherited,
    new Proxy({ wildcard: ["collections", "*", "*", "excerpt"] }, {}),
  ];
  for (const declaration of declarations) {
    const error = thrown(
      () => templating.renderSource({ subject: "invalid-wildcard", source: "", context, trusted: [declaration as TrustedPath] }),
      InvalidTrustedPath,
    );
    expect(error.index).toBe(0);
  }

  const valueError = thrown(
    () =>
      templating.renderSource({
        subject: "invalid-excerpt",
        source: "",
        context: { collections: { posts: [{ excerpt: 1 }] } },
        trusted: [TRUSTED_COLLECTION_EXCERPTS],
      }),
    InvalidTrustedValue,
  );
  expect(valueError.path).toEqual(["collections", "posts", "0", "excerpt"]);

  const decorated = [{ excerpt: "<p>Excerpt</p>" }] as { excerpt: string }[] & { extra?: boolean };
  decorated.extra = true;
  const shapeError = thrown(
    () =>
      templating.renderSource({
        subject: "decorated-collection",
        source: "",
        context: { collections: { posts: decorated } },
        trusted: [TRUSTED_COLLECTION_EXCERPTS],
      }),
    InvalidTrustedValue,
  );
  expect(shapeError.path).toEqual(["collections", "posts"]);
});

test("optional conditions and default are lenient while other undefined reads are errors", () => {
  const templating = new TemplatingConcept();
  const context = { page: { data: {} } };
  expect(
    templating.renderSource({
      subject: "optional",
      source: '{% if page.data.subtitle %}shown{% else %}hidden{% endif %}|{{ page.data.subtitle | default: "none" }}',
      context,
      trusted: [],
    }).output,
  ).toBe("hidden|none");

  const outputError = thrown(
    () => templating.renderSource({ subject: "undefined", source: "first\n{{ page.data.subtitle }}", context, trusted: [] }),
    UndefinedVariable,
  );
  expect(outputError.variable).toBe("page.data.subtitle");
  expect(outputError.line).toBe(2);
  expect(outputError.column).toBeGreaterThan(0);

  const loopError = thrown(
    () => templating.renderSource({ subject: "loop", source: "{% for item in page.data.items %}{{ item }}{% endfor %}", context, trusted: [] }),
    UndefinedVariable,
  );
  expect(loopError.variable).toBe("page.data.items");

  templating.define({ name: "undefined-partial", source: "first\n{{ missing }}" });
  const root = templating.define({ name: "undefined-root", source: '{% render "undefined-partial" %}' });
  const partialError = thrown(
    () => templating.renderTemplate({ template: root.template, subject: "partial", context: {}, trusted: [] }),
    UndefinedVariable,
  );
  expect(partialError.templateName).toBe("undefined-partial");
  expect(partialError.line).toBe(2);
});

test("other evaluation failures remain distinct from undefined values", () => {
  const templating = new TemplatingConcept();
  const page = {} as Record<string, unknown>;
  Object.defineProperty(page, "boom", {
    enumerable: true,
    get() {
      throw new Error("getter exploded");
    },
  });
  const error = thrown(
    () => templating.renderSource({ subject: "failed", source: "line\n{{ page.boom }}", context: { page }, trusted: [] }),
    TemplateFailed,
  );
  expect(error).not.toBeInstanceOf(UndefinedVariable);
  expect(error.detail).toContain("getter exploded");
  expect(error.line).toBe(2);
});

test("define, renderSource, and renderTemplate identities are stable and collision-free", () => {
  const templating = new TemplatingConcept();
  const colon = templating.define({ name: "a:b", source: "A" });
  const plain = templating.define({ name: "a", source: "B" });
  expect(templating.define({ name: "a:b", source: "A" })).toEqual({ template: colon.template, changed: false });
  expect(templating.define({ name: "a:b", source: "AA" })).toEqual({ template: colon.template, changed: true });

  const first = templating.renderTemplate({ template: colon.template, subject: "c", context: {}, trusted: [] });
  const second = templating.renderTemplate({ template: plain.template, subject: "b:c", context: {}, trusted: [] });
  expect(first.rendering).not.toBe(second.rendering);
  expect(templating._of({ rendering: first.rendering })).toEqual([
    { template: colon.template, subject: "c", output: "AA" },
  ]);
  expect(templating._of({ rendering: second.rendering })).toEqual([
    { template: plain.template, subject: "b:c", output: "B" },
  ]);
  expect(templating._of({ rendering: "unknown" })).toEqual([]);

  const filling = templating.renderSource({ subject: "a:b:c", source: "one", context: {}, trusted: [] });
  const replacement = templating.renderSource({ subject: "a:b:c", source: "two", context: {}, trusted: [] });
  expect(replacement.filling).toBe(filling.filling);
  expect(templating._filling({ subject: "a:b:c" })).toEqual([{ filling: filling.filling, output: "two" }]);
});

test("successful redefine and refill replace current dependency metadata", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "old-partial", source: "old" });
  templating.define({ name: "new-partial", source: "new" });
  const first = templating.define({
    name: "page",
    source: '{% render "old-partial" %}{{ site.old }}',
  });
  const before = templating._template({ name: "page" })[0]!.digest;
  const replacement = templating.define({
    name: "page",
    source: '{% render "new-partial" %}{{ site.new }}',
  });

  expect(replacement).toEqual({ template: first.template, changed: true });
  expect(templating._template({ name: "page" })[0]!.digest).not.toBe(before);
  expect(templating._uses({ owner: first.template })).toEqual([{ used: "new-partial" }]);
  expect(templating._tree({ owner: first.template })).toEqual([{ used: "new-partial" }]);
  expect(templating._reads({ owner: first.template })).toEqual([{ path: ["site", "new"] }]);
  expect(templating._usedBy({ name: "old-partial" })).toEqual([]);
  expect(templating._usedBy({ name: "new-partial" })).toEqual([{ owner: first.template }]);

  const filling = templating.renderSource({
    subject: "body",
    source: '{% render "old-partial" %}{{ site.old }}',
    context: { site: { old: "old" } },
    trusted: [],
  });
  const refilled = templating.renderSource({
    subject: "body",
    source: '{% render "new-partial" %}{{ site.new }}',
    context: { site: { new: "new" } },
    trusted: [],
  });
  expect(refilled.filling).toBe(filling.filling);
  expect(templating._tree({ owner: filling.filling })).toEqual([{ used: "new-partial" }]);
  expect(templating._reads({ owner: filling.filling })).toEqual([{ path: ["site", "new"] }]);
  expect(templating._usedBy({ name: "old-partial" })).toEqual([]);
  expect(templating._usedBy({ name: "new-partial" })).toEqual([
    { owner: filling.filling },
    { owner: first.template },
  ]);
});

test("successful outputs keep dependency snapshots across redefine and forget", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "partial", source: "{{ site.old }}" });
  const page = templating.define({ name: "page", source: '{% render "partial" %}' });
  const rendered = templating.renderTemplate({
    template: page.template,
    subject: "page",
    context: { site: { old: "old", new: "new" } },
    trusted: [],
  });
  expect(templating._reads({ owner: rendered.rendering })).toEqual([{ path: ["site", "old"] }]);

  const partial = templating.define({ name: "partial", source: "{{ site.new }}" });
  expect(partial.changed).toBe(true);
  expect(templating._reads({ owner: page.template })).toEqual([{ path: ["site", "new"] }]);
  expect(templating._reads({ owner: rendered.rendering })).toEqual([{ path: ["site", "old"] }]);
  expect(templating._rendering({ template: page.template, subject: "page" })).toEqual([
    { rendering: rendered.rendering, output: "old" },
  ]);

  templating.forget({ name: "partial" });
  expect(templating._template({ name: "partial" })).toEqual([]);
  expect(templating._tree({ owner: rendered.rendering })).toEqual([{ used: "partial" }]);
  expect(templating._reads({ owner: rendered.rendering })).toEqual([{ path: ["site", "old"] }]);
  thrown(
    () => templating.renderTemplate({ template: page.template, subject: "page", context: { site: {} }, trusted: [] }),
    UsedTemplateNotFound,
  );
});

test("failed renderSource and renderTemplate attempts preserve snapshots and expose subject failures", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "old", source: "{{ site.old }}" });
  templating.define({ name: "new", source: "{{ site.new }}" });
  const context = { page: { old: "page old" }, site: { old: "site old", new: "site new" } };
  const filling = templating.renderSource({
    subject: "body",
    source: '{% render "old" %}|{{ page.old }}',
    context,
    trusted: [],
  });
  const fillingTree = templating._tree({ owner: filling.filling });
  const fillingReads = templating._reads({ owner: filling.filling });
  thrown(
    () =>
      templating.renderSource({
        subject: "body",
        source: '{% render "new" %}\n{{ missing }}',
        context,
        trusted: [],
      }),
    UndefinedVariable,
  );
  expect(templating._filling({ subject: "body" })).toEqual([{ filling: filling.filling, output: "site old|page old" }]);
  expect(templating._tree({ owner: filling.filling })).toEqual(fillingTree);
  expect(templating._reads({ owner: filling.filling })).toEqual(fillingReads);
  const fillFailure = templating._failure({ subject: "body" });
  expect(fillFailure).toHaveLength(1);
  expect(fillFailure[0]).toMatchObject({ code: "UNDEFINED_VARIABLE", templateName: undefined, line: 2 });
  expect(fillFailure[0]!.column).toBeGreaterThan(0);

  const recovery = templating.define({ name: "recovery", source: "recovered" });
  expect(templating.renderTemplate({ template: recovery.template, subject: "body", context: {}, trusted: [] }).output).toBe("recovered");
  expect(templating._failure({ subject: "body" })).toEqual([]);
  expect(templating._tree({ owner: filling.filling })).toEqual(fillingTree);
  expect(templating._reads({ owner: filling.filling })).toEqual(fillingReads);

  const page = templating.define({ name: "page", source: '{% render "old" %}|{{ page.old }}' });
  const rendering = templating.renderTemplate({ template: page.template, subject: "page", context, trusted: [] });
  const renderingTree = templating._tree({ owner: rendering.rendering });
  const renderingReads = templating._reads({ owner: rendering.rendering });
  templating.define({ name: "page", source: '{% render "new" %}\n{{ missing }}' });
  thrown(
    () => templating.renderTemplate({ template: page.template, subject: "page", context, trusted: [] }),
    UndefinedVariable,
  );
  expect(templating._rendering({ template: page.template, subject: "page" })).toEqual([
    { rendering: rendering.rendering, output: "site old|page old" },
  ]);
  expect(templating._of({ rendering: rendering.rendering })).toEqual([
    { template: page.template, subject: "page", output: "site old|page old" },
  ]);
  expect(templating._tree({ owner: rendering.rendering })).toEqual(renderingTree);
  expect(templating._reads({ owner: rendering.rendering })).toEqual(renderingReads);
  const renderFailure = templating._failure({ subject: "page" });
  expect(renderFailure).toHaveLength(1);
  expect(renderFailure[0]).toMatchObject({ code: "UNDEFINED_VARIABLE", templateName: "page", line: 2 });
  expect(renderFailure[0]!.column).toBeGreaterThan(0);

  expect(templating.renderSource({ subject: "page", source: "recovered", context: {}, trusted: [] }).output).toBe("recovered");
  expect(templating._failure({ subject: "page" })).toEqual([]);
  expect(templating._tree({ owner: rendering.rendering })).toEqual(renderingTree);
  expect(templating._reads({ owner: rendering.rendering })).toEqual(renderingReads);

  thrown(
    () => templating.renderTemplate({ template: "missing", subject: "missing", context: {}, trusted: [] }),
    TemplateNotFound,
  );
  expect(templating._failure({ subject: "missing" })).toEqual([
    { code: "TEMPLATE_NOT_FOUND", templateName: undefined, line: undefined, column: undefined },
  ]);
  expect(templating.renderSource({ subject: "missing", source: "recovered", context: {}, trusted: [] }).output).toBe("recovered");
  expect(templating._failure({ subject: "missing" })).toEqual([]);
});

test("named fills report original source coordinates and a fallback source", () => {
  const templating = new TemplatingConcept();

  thrown(
    () => templating.renderSource({
      subject: "body",
      source: "{{ missing }}",
      context: {},
      trusted: [],
      sourceName: "posts/example.md",
      sourceLine: 8,
    }),
    UndefinedVariable,
  );

  expect(templating._failure({ subject: "body" })).toEqual([
    expect.objectContaining({
      code: "UNDEFINED_VARIABLE",
      templateName: "posts/example.md",
      line: 8,
    }),
  ]);
  expect(templating._failureLocation({ subject: "body", fallbackSource: "fallback.md" })).toEqual([
    expect.objectContaining({ source: "posts/example.md", line: 8 }),
  ]);

  thrown(
    () => templating.renderTemplate({ template: "missing", subject: "missing", context: {}, trusted: [] }),
    TemplateNotFound,
  );
  expect(templating._failureLocation({ subject: "missing", fallbackSource: "fallback.md" })).toEqual([
    { source: "fallback.md", line: undefined, column: undefined },
  ]);
});

test("renderSource is unnamed, snapshots dependencies, and is independent from renderTemplate", () => {
  const templating = new TemplatingConcept();
  templating.define({ name: "partial", source: "{{ site.title }}" });
  const layout = templating.define({ name: "layout", source: "layout {{ page.title }}" });
  const filling = templating.renderSource({
    subject: "body",
    source: '{% render "partial" %} {{ page.body }}',
    context: { page: { body: "body" }, site: { title: "site" } },
    trusted: [],
  });
  const rendering = templating.renderTemplate({
    template: layout.template,
    subject: "body",
    context: { page: { title: "title" } },
    trusted: [],
  });

  expect(templating._template({ name: "body" })).toEqual([]);
  expect(templating._tree({ owner: filling.filling })).toEqual([{ used: "partial" }]);
  expect(templating._reads({ owner: filling.filling })).toEqual([
    { path: ["page", "body"] },
    { path: ["site", "title"] },
  ]);
  expect(templating._rendering({ template: layout.template, subject: "body" })).toEqual([
    { rendering: rendering.rendering, output: "layout title" },
  ]);
});

test("forget removes a definition and its direct renderings only", () => {
  const templating = new TemplatingConcept();
  const partial = templating.define({ name: "partial", source: "partial" });
  const direct = templating.renderTemplate({ template: partial.template, subject: "direct", context: {}, trusted: [] });
  const filling = templating.renderSource({ subject: "body", source: '{% render "partial" %}', context: {}, trusted: [] });

  expect(templating.forget({ name: "partial" })).toEqual({ template: partial.template });
  expect(templating._rendering({ template: partial.template, subject: "direct" })).toEqual([]);
  expect(templating._of({ rendering: direct.rendering })).toEqual([]);
  expect(templating._filling({ subject: "body" })).toEqual([{ filling: filling.filling, output: "partial" }]);
  expect(templating._tree({ owner: filling.filling })).toEqual([{ used: "partial" }]);
  thrown(() => templating.forget({ name: "partial" }), TemplateNotFound);
});

test("registered origins atomically own logical template names", () => {
  const templating = new TemplatingConcept();
  templating.register({ name: "page", source: "one", origin: "templates/page" });
  templating.register({ name: "page", source: "two", origin: "templates/page" });
  expect(() => templating.register({ name: "page", source: "other", origin: "includes/page" })).toThrow(TemplateNameTaken);
  expect(templating._template({ name: "page" })).toHaveLength(1);
});

test("the registry maps every declared refusal to its error class", () => {
  expect(registration.refusals).toEqual({
    INVALID_TEMPLATE_ORIGIN: InvalidTemplateOrigin,
    INVALID_TRUSTED_PATH: InvalidTrustedPath,
    INVALID_TRUSTED_VALUE: InvalidTrustedValue,
    RECURSIVE_TEMPLATE: RecursiveTemplate,
    TEMPLATE_FAILED: TemplateFailed,
    TEMPLATE_NAME_TAKEN: TemplateNameTaken,
    TEMPLATE_NOT_FOUND: TemplateNotFound,
    TEMPLATE_SYNTAX: TemplateSyntax,
    UNDEFINED_VARIABLE: UndefinedVariable,
    UNSUPPORTED_TEMPLATE: UnsupportedTemplate,
    USED_TEMPLATE_NOT_FOUND: UsedTemplateNotFound,
  });
  expect(
    registration.specification.actions.map((action) => [
      action.name,
      action.refusals.map((refusal) => refusal.code),
    ]),
  ).toEqual([
    ["define", ["TEMPLATE_NAME_TAKEN", "TEMPLATE_SYNTAX", "UNSUPPORTED_TEMPLATE"]],
    ["register", ["INVALID_TEMPLATE_ORIGIN", "TEMPLATE_NAME_TAKEN", "TEMPLATE_SYNTAX", "UNSUPPORTED_TEMPLATE"]],
    ["forget", ["TEMPLATE_NOT_FOUND"]],
    [
      "renderSource",
      [
        "TEMPLATE_SYNTAX",
        "UNSUPPORTED_TEMPLATE",
        "INVALID_TRUSTED_PATH",
        "INVALID_TRUSTED_VALUE",
        "USED_TEMPLATE_NOT_FOUND",
        "RECURSIVE_TEMPLATE",
        "UNDEFINED_VARIABLE",
        "TEMPLATE_FAILED",
      ],
    ],
    [
      "renderTemplate",
      [
        "TEMPLATE_NOT_FOUND",
        "INVALID_TRUSTED_PATH",
        "INVALID_TRUSTED_VALUE",
        "USED_TEMPLATE_NOT_FOUND",
        "RECURSIVE_TEMPLATE",
        "UNDEFINED_VARIABLE",
        "TEMPLATE_FAILED",
      ],
    ],
  ]);
});
