import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { expect, test } from "bun:test";
import {
  ConversionFailed,
  ConvertingConcept,
  IncompatibleProfile,
  InvalidConversionInput,
  InvalidProfile,
  InvalidSubject,
  ProfileNotFound,
  UnsupportedExtension,
  UnsupportedProfileKind,
} from "./converting.ts";
import { converting as convertingRegistration } from "./registry.ts";

const ALL_EXTENSIONS = ["tables", "footnotes", "strikethrough", "autolinks"];
const FEATURE_SOURCE = `| A |
| - |
| B |

Gone: ~~yes~~. Visit www.example.com. Note[^One].

[^one]: Foot note.
`;

function markdown(
  converting: ConvertingConcept,
  name: string,
  extensions: string[] = [],
  raw = true,
  separator = "<!--more-->",
) {
  return converting.declare({ name, kind: "markdown", extensions, raw, separator });
}

function output(converting: ConvertingConcept, profile: string, source: string, subject = "page", part = "body") {
  return converting.convert({ subject, part, profile, source }).output;
}

test("its principle: explicit profiles convert cached, independent subject parts", () => {
  const converting = new ConvertingConcept();
  const declared = markdown(converting, "prose", ALL_EXTENSIONS, true, "<!--more-->");
  const body = converting.convert({
    subject: "page",
    part: "body",
    profile: declared.profile,
    source: "# Notes\n\nBefore<!--more-->After",
  });
  const summary = converting.convert({
    subject: "page",
    part: "summary",
    profile: declared.profile,
    source: "A *short* summary.",
  });

  expect(body.output).toBe("<h1>Notes</h1>\n<p>Before<!--more-->After</p>\n");
  expect(converting._excerpt({ subject: "page", part: "body" })).toEqual([
    { conversion: body.conversion, excerpt: "<h1>Notes</h1>\n<p>Before</p>\n" },
  ]);
  expect(converting._for({ subject: "page", part: "body" })[0]?.output).toBe(body.output);
  expect(converting._for({ subject: "page", part: "summary" })[0]?.output).toBe(summary.output);
  expect(
    converting.convert({
      subject: "page",
      part: "body",
      profile: declared.profile,
      source: "# Notes\n\nBefore<!--more-->After",
    }),
  ).toEqual(body);
});

test("tables are independent from every other optional Markdown extension", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "tables-only", ["tables"]).profile;
  const rendered = output(converting, profile, FEATURE_SOURCE);

  expect(rendered).toContain("<table>");
  expect(rendered).toContain("~~yes~~");
  expect(rendered).toContain("www.example.com");
  expect(rendered).not.toContain('href="http://www.example.com"');
  expect(rendered).toContain("Note[^One]");
  expect(rendered).toContain("[^one]: Foot note.");
});

test("footnotes are independent, case-insensitive, ordered, and backlink repeated references", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "footnotes-only", ["footnotes"]).profile;
  const rendered = output(
    converting,
    profile,
    `| A |
| - |
| B |

One[^NOTE], again[^note], undefined[^missing]. ~~plain~~ www.example.com

[^note]: First line
    continued

[^unused]: Hidden
`,
  );

  expect(rendered).not.toContain("<table>");
  expect(rendered).toContain("| A |");
  expect(rendered).toContain("~~plain~~");
  expect(rendered).not.toContain('href="http://www.example.com"');
  expect(rendered).toContain('id="fnref-note"');
  expect(rendered).toContain('id="fnref-note-2"');
  expect(rendered).toContain('id="fn-note"');
  expect(rendered).toContain("First line\ncontinued");
  expect(rendered).toContain("undefined[^missing]");
  expect(rendered).not.toContain("Hidden");
  expect(rendered).toContain('href="#fnref-note-2"');
});

test("strikethrough is independent from tables, footnotes, and autolinks", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "strike-only", ["strikethrough"]).profile;
  const rendered = output(converting, profile, FEATURE_SOURCE);

  expect(rendered).toContain("<del>yes</del>");
  expect(rendered).not.toContain("<table>");
  expect(rendered).not.toContain('href="http://www.example.com"');
  expect(rendered).toContain("Note[^One]");
});

test("bare autolinks are independent while angle autolinks remain base Markdown", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "links-only", ["autolinks"]).profile;
  const rendered = output(converting, profile, `${FEATURE_SOURCE}\n<https://example.org> contact@example.org`);

  expect(rendered).toContain('href="http://www.example.com"');
  expect(rendered).toContain('href="mailto:contact@example.org"');
  expect(rendered).toContain('href="https://example.org"');
  expect(rendered).not.toContain("<table>");
  expect(rendered).toContain("~~yes~~");
  expect(rendered).toContain("Note[^One]");
});

test("all optional Markdown extensions compose without enabling task lists", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "complete", ALL_EXTENSIONS).profile;
  const rendered = output(converting, profile, `${FEATURE_SOURCE}\n- [x] remains text`);

  expect(rendered).toContain("<table>");
  expect(rendered).toContain("<del>yes</del>");
  expect(rendered).toContain('href="http://www.example.com"');
  expect(rendered).toContain('class="footnotes"');
  expect(rendered).toContain("<li>[x] remains text</li>");
  expect(rendered).not.toContain('type="checkbox"');
});

test("raw HTML is copied only when the Markdown profile permits it", () => {
  const converting = new ConvertingConcept();
  const permissive = markdown(converting, "permissive", [], true).profile;
  const encoded = markdown(converting, "encoded", [], false).profile;
  const source = "Before <em>x</em>\n\n<script>alert(1)</script>";

  expect(output(converting, permissive, source, "raw", "true")).toBe(
    "<p>Before <em>x</em></p>\n<script>alert(1)</script>",
  );
  expect(output(converting, encoded, source, "raw", "false")).toBe(
    "<p>Before &lt;em&gt;x&lt;/em&gt;</p>\n&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

test("profile kind, not profile name, selects Markdown or verbatim", () => {
  const converting = new ConvertingConcept();
  const namedVerbatim = converting.declare({
    name: "markdown",
    kind: "verbatim",
    extensions: [],
    raw: true,
    separator: "<!--more-->",
  }).profile;
  const namedMarkdown = markdown(converting, "verbatim").profile;
  const source = "# {{ already_filled }}";

  expect(output(converting, namedVerbatim, source, "kinds", "verbatim")).toBe(source);
  expect(output(converting, namedMarkdown, source, "kinds", "markdown")).toBe(
    "<h1>{{ already_filled }}</h1>\n",
  );
});

test("verbatim preserves exact text and independently extracts an exact prefix", () => {
  const converting = new ConvertingConcept();
  const profile = converting.declare({
    name: "html",
    kind: "verbatim",
    extensions: [],
    raw: true,
    separator: "<!--more-->",
  }).profile;
  const source = "<p>Before</p><!--more--><p>After</p>\n";
  const converted = converting.convert({ subject: "page", part: "html", profile, source });

  expect(converted.output).toBe(source);
  expect(converting._excerpt({ subject: "page", part: "html" })).toEqual([
    { conversion: converted.conversion, excerpt: "<p>Before</p>" },
  ]);
});

test("separator absence, beginning, middle, end, repetition, and disabling are unambiguous", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "excerpts", [], true, "--more--").profile;
  const cases = [
    ["none", "Before", undefined],
    ["beginning", "--more--After", ""],
    ["middle", "Before--more--After", "<p>Before</p>\n"],
    ["end", "Before--more--", "<p>Before</p>\n"],
    ["repeated", "Before--more--Middle--more--After", "<p>Before</p>\n"],
  ] as const;

  for (const [part, source, excerpt] of cases) {
    const converted = converting.convert({ subject: "page", part, profile, source });
    expect(converted.output).toContain(source);
    expect(converting._excerpt({ subject: "page", part })).toEqual(
      excerpt === undefined ? [] : [{ conversion: converted.conversion, excerpt }],
    );
  }

  const disabled = markdown(converting, "no-excerpts", [], true, "").profile;
  converting.convert({ subject: "page", part: "disabled", profile: disabled, source: "anything" });
  expect(converting._excerpt({ subject: "page", part: "disabled" })).toEqual([]);
});

test("declarations normalize extension sets, clone observations, and report exact changes", () => {
  const converting = new ConvertingConcept();
  const supplied = ["autolinks", "tables"];
  const first = markdown(converting, "stable", supplied, true, "cut");
  supplied.length = 0;

  expect(first.changed).toBe(true);
  expect(converting._profile({ name: "stable" })).toEqual([
    {
      profile: first.profile,
      kind: "markdown",
      extensions: ["tables", "autolinks"],
      raw: true,
      separator: "cut",
    },
  ]);
  expect(markdown(converting, "stable", ["tables", "autolinks"], true, "cut")).toEqual({
    profile: first.profile,
    changed: false,
  });

  const observed = converting._profile({ name: "stable" })[0]!.extensions;
  observed.push("footnotes");
  expect(converting._profile({ name: "stable" })[0]!.extensions).toEqual(["tables", "autolinks"]);

  const other = new ConvertingConcept();
  expect(markdown(other, "stable", ["autolinks", "tables"], true, "cut").profile).toBe(first.profile);
});

test("malformed, unsupported, duplicate, and incompatible declarations are atomic", () => {
  const converting = new ConvertingConcept();
  const original = markdown(converting, "prose", ["tables"]).profile;

  expect(() =>
    converting.declare({ name: "prose", kind: "rst", extensions: [], raw: true, separator: "" }),
  ).toThrow(UnsupportedProfileKind);
  expect(() =>
    converting.declare({
      name: "prose",
      kind: "rst",
      extensions: null as unknown as string[],
      raw: true,
      separator: "",
    }),
  ).toThrow(InvalidProfile);
  expect(() =>
    converting.declare({ name: "prose", kind: "rst", extensions: ["smartypants"], raw: true, separator: "" }),
  ).toThrow(UnsupportedProfileKind);
  expect(() => markdown(converting, "prose", ["smartypants"])).toThrow(UnsupportedExtension);
  expect(() => markdown(converting, "prose", ["tables", "tables"])).toThrow(InvalidProfile);
  expect(() => markdown(converting, "prose", ["smartypants", "smartypants"])).toThrow(InvalidProfile);
  expect(() =>
    converting.declare({ name: "html", kind: "verbatim", extensions: ["tables"], raw: true, separator: "" }),
  ).toThrow(IncompatibleProfile);
  expect(() =>
    converting.declare({ name: "html", kind: "verbatim", extensions: [], raw: false, separator: "" }),
  ).toThrow(IncompatibleProfile);
  expect(() => markdown(converting, "", [])).toThrow(InvalidProfile);
  expect(() =>
    converting.declare({ name: "bad", kind: "markdown", extensions: null as unknown as string[], raw: true, separator: "" }),
  ).toThrow(InvalidProfile);
  expect(() =>
    converting.declare({ name: "bad", kind: "markdown", extensions: [], raw: "yes" as unknown as boolean, separator: "" }),
  ).toThrow(InvalidProfile);
  expect(converting._profile({ name: "prose" })[0]?.profile).toBe(original);
});

test("replacing a profile revokes its identity and every conversion made with it", () => {
  const converting = new ConvertingConcept();
  const first = markdown(converting, "prose", [], true).profile;
  const converted = converting.convert({ subject: "page", part: "body", profile: first, source: "<b>raw</b>" });
  const changed = markdown(converting, "prose", [], false);

  expect(changed.changed).toBe(true);
  expect(changed.profile).not.toBe(first);
  expect(converting._conversion({ conversion: converted.conversion })).toEqual([]);
  expect(converting._for({ subject: "page", part: "body" })).toEqual([]);
  expect(() => converting.convert({ subject: "page", part: "body", profile: first, source: "text" })).toThrow(
    ProfileNotFound,
  );
  expect(output(converting, changed.profile, "<b>raw</b>")).toContain("&lt;b&gt;raw&lt;/b&gt;");

  const restored = markdown(converting, "prose", [], true);
  expect(restored.profile).toBe(first);
  expect(restored.changed).toBe(true);
});

test("conversion identities are stable, cache by exact slot/profile/source, and avoid delimiter collisions", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "prose").profile;
  const first = converting.convert({ subject: "a:b", part: "c", profile, source: "one" });
  const second = converting.convert({ subject: "a", part: "b:c", profile, source: "two" });

  expect(first.conversion).not.toBe(second.conversion);
  expect(converting._conversion({ conversion: first.conversion })[0]).toMatchObject({
    subject: "a:b",
    part: "c",
    profile,
    output: "<p>one</p>\n",
  });
  expect(converting._conversion({ conversion: second.conversion })[0]).toMatchObject({
    subject: "a",
    part: "b:c",
    output: "<p>two</p>\n",
  });

  const changed = converting.convert({ subject: "a:b", part: "c", profile, source: "changed" });
  expect(changed.conversion).toBe(first.conversion);
  expect(changed.output).toBe("<p>changed</p>\n");
  expect(converting._conversion({ conversion: first.conversion })[0]?.digest).toHaveLength(64);

  const other = new ConvertingConcept();
  const otherProfile = markdown(other, "prose").profile;
  expect(other.convert({ subject: "a:b", part: "c", profile: otherProfile, source: "changed" }).conversion).toBe(
    changed.conversion,
  );
});

test("failed Markdown conversion leaves the previous output and excerpt atomic", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "notes", ["footnotes"]).profile;
  const previous = converting.convert({ subject: "page", part: "body", profile, source: "Before<!--more-->After" });
  const previousRecord = converting._for({ subject: "page", part: "body" });
  const previousExcerpt = converting._excerpt({ subject: "page", part: "body" });
  const duplicate = "Use[^a].\n\n[^a]: One\n\n[^A]: Two\n";

  expect(() => converting.convert({ subject: "page", part: "body", profile, source: duplicate })).toThrow(
    ConversionFailed,
  );
  expect(() =>
    converting.convert({ subject: "new", part: "body", profile, source: "Use[^empty].\n\n[^empty]:\n" }),
  ).toThrow(ConversionFailed);
  expect(converting._for({ subject: "page", part: "body" })).toEqual(previousRecord);
  expect(converting._excerpt({ subject: "page", part: "body" })).toEqual(previousExcerpt);
  expect(converting._conversion({ conversion: previous.conversion })[0]?.output).toBe(previous.output);
  expect(converting._for({ subject: "new", part: "body" })).toEqual([]);
});

test("conversion input validation, unknown profiles, queries, and release are precise", () => {
  const converting = new ConvertingConcept();
  const profile = markdown(converting, "prose").profile;
  const body = converting.convert({ subject: "page", part: "body", profile, source: "Body" });
  converting.convert({ subject: "page", part: "summary", profile, source: "Summary" });
  converting.convert({ subject: "other", part: "body", profile, source: "Other" });

  expect(() => converting.convert({ subject: "page", part: "body", profile: "absent", source: "" })).toThrow(
    ProfileNotFound,
  );
  expect(() =>
    converting.convert({ subject: 1 as unknown as string, part: "body", profile, source: "" }),
  ).toThrow(InvalidConversionInput);
  expect(() => converting.release({ subject: null as unknown as string })).toThrow(InvalidSubject);
  expect(converting._profile({ name: "absent" })).toEqual([]);
  expect(converting._conversion({ conversion: "absent" })).toEqual([]);
  expect(converting._for({ subject: "absent", part: "body" })).toEqual([]);
  expect(converting._excerpt({ subject: "absent", part: "body" })).toEqual([]);

  expect(converting.release({ subject: "page" })).toEqual({ subject: "page", count: 2 });
  expect(converting._conversion({ conversion: body.conversion })).toEqual([]);
  expect(converting._for({ subject: "other", part: "body" })).toHaveLength(1);
  expect(converting.release({ subject: "page" })).toEqual({ subject: "page", count: 0 });
  expect(converting._profile({ name: "prose" })).toHaveLength(1);
});

test("registry maps every refusal and supplies exact boundary messages", async () => {
  expect(convertingRegistration.refusals).toEqual({
    INVALID_PROFILE: InvalidProfile,
    UNSUPPORTED_PROFILE_KIND: UnsupportedProfileKind,
    UNSUPPORTED_EXTENSION: UnsupportedExtension,
    INCOMPATIBLE_PROFILE: IncompatibleProfile,
    PROFILE_NOT_FOUND: ProfileNotFound,
    INVALID_CONVERSION_INPUT: InvalidConversionInput,
    INVALID_SUBJECT: InvalidSubject,
    CONVERSION_FAILED: ConversionFailed,
  });

  const concepts = conceptSet({ Converting: convertingRegistration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  const Converting = app.concepts.Converting;
  expect(
    await Converting.declare({ name: "bad", kind: "rst", extensions: [], raw: true, separator: "" }),
  ).toEqual({
    error: "UNSUPPORTED_PROFILE_KIND",
    detail: "This rendering profile kind is not supported.",
  });
  expect(
    await Converting.declare({ name: "bad", kind: "markdown", extensions: ["unknown"], raw: true, separator: "" }),
  ).toEqual({ error: "UNSUPPORTED_EXTENSION", detail: "This Markdown extension is not supported." });
  expect(
    await Converting.declare({ name: "bad", kind: "verbatim", extensions: [], raw: false, separator: "" }),
  ).toEqual({
    error: "INCOMPATIBLE_PROFILE",
    detail: "A verbatim profile requires no extensions and raw true.",
  });
  expect(await Converting.convert({ subject: "s", part: "p", profile: "missing", source: "text" })).toEqual({
    error: "PROFILE_NOT_FOUND",
    detail: "There is no such current rendering profile.",
  });

  const declared = await Converting.declare({
    name: "notes",
    kind: "markdown",
    extensions: ["footnotes"],
    raw: true,
    separator: "",
  });
  if (!("profile" in declared)) throw new Error("Expected the profile declaration to succeed.");
  const profile = declared.profile as string;
  expect(
    await Converting.convert({
      subject: "s",
      part: "p",
      profile,
      source: "Use[^a].\n\n[^a]: One\n\n[^A]: Two",
    }),
  ).toEqual({ error: "CONVERSION_FAILED", detail: "This text could not be converted." });
  expect(await Converting.release({ subject: 1 as unknown as string })).toEqual({
    error: "INVALID_SUBJECT",
    detail: "A conversion subject must be text.",
  });
  await app.whenIdle();
});
