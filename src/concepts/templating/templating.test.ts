import { expect, test } from "bun:test";
import {
  RecursiveTemplate,
  TemplateFailed,
  TemplateNotFound,
  TemplateSyntax,
  TemplatingConcept,
  UsedTemplateNotFound,
} from "./templating.ts";

test("its principle: templates compose, track dependencies, and escape supplied context", () => {
  const templating = new TemplatingConcept();
  const masthead = templating.define({ name: "masthead.html", source: "<header>{{ site.title }}</header>" });
  const header = templating.define({ name: "header.html", source: '{% render "masthead.html" %}' });
  const footer = templating.define({ name: "footer.html", source: "<footer>Copyright</footer>" });
  const page = templating.define({
    name: "page.html",
    source: '{% render "header.html" %}<main><h1>{{ page.data.title }}</h1>{{ page.content }}</main>{% render "footer.html" %}',
  });
  const context = {
    site: { title: "Ada & Bob" },
    page: { content: "<p>trusted</p>", data: { title: "Compiler <Design>" } },
  };

  expect(templating._uses({ owner: page.template })).toEqual([{ used: "header.html" }, { used: "footer.html" }]);
  expect(templating._tree({ owner: page.template })).toEqual([{ used: "header.html" }, { used: "masthead.html" }, { used: "footer.html" }]);
  expect(templating._reads({ owner: page.template })).toEqual([
    { root: "page", member: "data.title" },
    { root: "page", member: "content" },
  ]);
  expect(templating._usedBy({ name: "header.html" })).toEqual([{ owner: page.template }]);

  const filling = templating.fill({ subject: "body", source: '{% render "header.html" %}{{ page.content }}', context, raw: ["page.content"] });
  const otherFilling = templating.fill({ subject: "other-body", source: "{{ page.data.title }}", context, raw: [] });
  expect(filling.output).toBe("<header>Ada &amp; Bob</header><p>trusted</p>");
  expect(otherFilling.output).toBe("Compiler &lt;Design&gt;");
  expect(templating._filling({ subject: "body" })).toEqual([{ filling: filling.filling, output: filling.output }]);
  expect(templating._template({ name: "body" })).toEqual([]);
  expect(templating._tree({ owner: filling.filling })).toEqual([{ used: "header.html" }, { used: "masthead.html" }]);
  expect(templating._reads({ owner: filling.filling })).toEqual([{ root: "page", member: "content" }]);

  const first = templating.render({ template: page.template, subject: "first", context, raw: ["page.content"] });
  const second = templating.render({
    template: page.template,
    subject: "second",
    context: { ...context, page: { ...context.page, content: "<p>second</p>" } },
    raw: ["page.content"],
  });
  expect(first.output).toBe("<header>Ada &amp; Bob</header><main><h1>Compiler &lt;Design&gt;</h1><p>trusted</p></main><footer>Copyright</footer>");
  expect(second.output).toContain("<p>second</p>");
  expect(templating._rendering({ template: page.template, subject: "first" })).toEqual([{ rendering: first.rendering, output: first.output }]);
  expect(templating._of({ rendering: first.rendering })).toEqual({ template: page.template, subject: "first", output: first.output });

  expect(templating.define({ name: "masthead.html", source: "<header>{{ site.title }}</header>" })).toEqual({ template: masthead.template, changed: false });
  expect(templating.define({ name: "header.html", source: '{% render "page.html" %}' }).changed).toBe(true);
  expect(() => templating.render({ template: page.template, subject: "recursive", context, raw: ["page.content"] })).toThrow(RecursiveTemplate);
  try {
    templating.fill({ subject: "missing", source: '{% render "missing.html" %}', context, raw: [] });
    throw new Error("The missing partial was rendered.");
  } catch (error) {
    expect(error).toBeInstanceOf(UsedTemplateNotFound);
    expect((error as UsedTemplateNotFound).used).toBe("missing.html");
  }
  expect(() => templating.define({ name: "broken.html", source: "{% if site.title %}" })).toThrow(TemplateSyntax);
  expect(() => templating.fill({ subject: "failed", source: "{{ page.nope }}", context, raw: [] })).toThrow(TemplateFailed);

  expect(templating.forget({ name: "footer.html" })).toEqual({ template: footer.template });
  expect(() => templating.forget({ name: "footer.html" })).toThrow(TemplateNotFound);
});
