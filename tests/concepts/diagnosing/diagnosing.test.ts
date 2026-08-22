import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  DiagnosingConcept,
  DiagnosticNotFound,
  InvalidLocation,
  InvalidText,
  UnknownSeverity,
} from "@concepts/diagnosing/diagnosing.ts";
import { diagnosing as registeredDiagnosing } from "@concepts/diagnosing/registry.ts";

type Report = Parameters<DiagnosingConcept["report"]>[0];
type Relation = Parameters<DiagnosingConcept["addRelatedLocation"]>[0];

function report(diagnosing: DiagnosingConcept, overrides: Partial<Report> = {}) {
  return diagnosing.report({
    severity: "error",
    code: "FORMAT",
    message: "This value has the wrong form.",
    source: "records/alpha.txt",
    line: 1,
    column: 1,
    ...overrides,
  });
}

test("its principle: problems accumulate, repeat idempotently, and retract by source", () => {
  const diagnosing = new DiagnosingConcept();
  const first = report(diagnosing, {
    code: "REQUIRED_VALUE",
    message: "A required value is absent.",
    line: 2,
    column: 8,
  });
  const related = diagnosing.addRelatedLocation({
    diagnostic: first.diagnostic,
    source: "rules/catalog.txt",
    line: 1,
    note: "This rule requires the value.",
  });
  report(diagnosing, {
    severity: "warning",
    code: "OLD_VALUE",
    message: "This value is no longer preferred.",
    source: "records/beta.txt",
    line: 4,
    column: 3,
  });
  report(diagnosing, {
    code: "FORMAT",
    message: "This value has the wrong form.",
    line: 8,
    column: 1,
  });

  expect(diagnosing._all().map(({ severity, source, line, code }) => ({ severity, source, line, code }))).toEqual([
    { severity: "error", source: "records/alpha.txt", line: 2, code: "REQUIRED_VALUE" },
    { severity: "error", source: "records/alpha.txt", line: 8, code: "FORMAT" },
    { severity: "warning", source: "records/beta.txt", line: 4, code: "OLD_VALUE" },
  ]);
  expect(diagnosing._related({ diagnostic: first.diagnostic })).toEqual([
    { source: "rules/catalog.txt", line: 1, column: undefined, note: "This rule requires the value." },
  ]);
  expect(diagnosing._clean()).toEqual({ clean: false });

  expect(report(diagnosing, { code: "REQUIRED_VALUE", message: "A later message.", line: 2, column: 8 })).toEqual(first);
  expect(diagnosing.addRelatedLocation({
    diagnostic: first.diagnostic,
    source: "rules/catalog.txt",
    line: 1,
    note: "This rule requires the value.",
  })).toEqual(related);
  expect(diagnosing._for({ source: "records/alpha.txt" })[0]!.message).toBe("A required value is absent.");
  expect(diagnosing._related({ diagnostic: first.diagnostic })).toHaveLength(1);

  expect(diagnosing.retractGroup({ source: "records/alpha.txt" })).toEqual({ scope: undefined, source: "records/alpha.txt", count: 2 });
  expect(diagnosing._clean()).toEqual({ clean: true });
  expect(diagnosing.clear()).toEqual({ count: 1 });
  expect(diagnosing._all()).toEqual([]);
});

test("scopes isolate replacement for checks that share one source", () => {
  const diagnosing = new DiagnosingConcept();
  const assessment = report(diagnosing, { scope: "assessment", source: "site.yaml", line: undefined, column: undefined });
  const settings = report(diagnosing, { scope: "settings", source: "site.yaml", line: undefined, column: undefined });
  expect(assessment.diagnostic).not.toBe(settings.diagnostic);

  expect(diagnosing.retractGroup({ scope: "assessment", source: "site.yaml" })).toEqual({
    scope: "assessment",
    source: "site.yaml",
    count: 1,
  });
  expect(diagnosing._all()).toEqual([expect.objectContaining({ diagnostic: settings.diagnostic, scope: "settings" })]);
});

test("diagnostic ordering is total, UTF-8 based, and independent of arrival", () => {
  const inputs: Report[] = [
    { severity: "error", code: "GLOBAL", message: "global", source: undefined },
    { severity: "error", code: "SOURCE", message: "source", source: "a" },
    { severity: "error", code: "LINE", message: "line", source: "a", line: 1 },
    { severity: "error", code: "BETA", message: "beta", source: "a", line: 1, column: 1 },
    { severity: "error", code: "ALPHA", message: "alpha", source: "a", line: 1, column: 1 },
    { severity: "error", code: "COLUMN", message: "column", source: "a", line: 1, column: 2 },
    { severity: "error", code: "LATER", message: "later", source: "a", line: 2 },
    { severity: "error", code: "B", message: "b", source: "b" },
    { severity: "error", code: "ACCENT", message: "accent", source: "\u00e9" },
    { severity: "warning", code: "WARNING", message: "warning", source: undefined },
  ];

  const build = (arrival: Report[]) => {
    const diagnosing = new DiagnosingConcept();
    for (const input of arrival) diagnosing.report(input);
    return diagnosing;
  };
  const forward = build(inputs);
  const reverse = build([...inputs].reverse());

  expect(reverse._all()).toEqual(forward._all());
  expect(forward._all().map(({ message }) => message)).toEqual([
    "global",
    "source",
    "line",
    "alpha",
    "beta",
    "column",
    "later",
    "b",
    "accent",
    "warning",
  ]);
  expect(forward._errors().map(({ message }) => message)).toEqual(forward._all().slice(0, -1).map(({ message }) => message));
  expect(forward._for({ source: "a" }).map(({ message }) => message)).toEqual([
    "source",
    "line",
    "alpha",
    "beta",
    "column",
    "later",
  ]);
  expect(forward._for({}).map(({ message }) => message)).toEqual(["global", "warning"]);

  for (const row of forward._all()) {
    expect(Object.hasOwn(row, "source")).toBe(true);
    expect(Object.hasOwn(row, "line")).toBe(true);
    expect(Object.hasOwn(row, "column")).toBe(true);
  }
});

test("keyed identities are collision-safe, stable, and distinguish independent problems", () => {
  const first = new DiagnosingConcept();
  const left = first.report({ severity: "error", code: "a:b", message: "left", source: "c" });
  const right = first.report({ severity: "error", code: "a", message: "right", source: "b:c" });
  const anotherCode = first.report({ severity: "error", code: "other", message: "other", source: "c" });
  const warning = first.report({ severity: "warning", code: "a:b", message: "warning", source: "c" });
  const global = first.report({ severity: "error", code: "global", message: "first" });

  expect(new Set([left.diagnostic, right.diagnostic, anotherCode.diagnostic, warning.diagnostic, global.diagnostic])).toHaveLength(5);
  expect(first.report({ severity: "error", code: "global", message: "ignored", source: undefined })).toEqual(global);

  const second = new DiagnosingConcept();
  expect(second.report({ severity: "error", code: "a:b", message: "left", source: "c" })).toEqual(left);
  expect(second.report({ severity: "error", code: "a", message: "right", source: "b:c" })).toEqual(right);
});

test("related locations are optional, idempotent, stable, and totally ordered", () => {
  const relations: Omit<Relation, "diagnostic">[] = [
    { source: "a", note: "z" },
    { source: "a", note: "a" },
    { source: "a", line: 1, note: "line" },
    { source: "a", line: 1, column: 1, note: "column" },
    { source: "b", note: "other source" },
  ];
  const build = (arrival: Omit<Relation, "diagnostic">[]) => {
    const diagnosing = new DiagnosingConcept();
    const diagnostic = report(diagnosing, { source: undefined, line: undefined, column: undefined });
    const identities = arrival.map((relation) => diagnosing.addRelatedLocation({ diagnostic: diagnostic.diagnostic, ...relation }).relation);
    return { diagnosing, diagnostic, identities };
  };

  const forward = build(relations);
  const reverse = build([...relations].reverse());
  expect(reverse.diagnosing._related({ diagnostic: reverse.diagnostic.diagnostic })).toEqual(
    forward.diagnosing._related({ diagnostic: forward.diagnostic.diagnostic }),
  );
  expect(forward.diagnosing._related({ diagnostic: forward.diagnostic.diagnostic })).toEqual([
    { source: "a", line: undefined, column: undefined, note: "a" },
    { source: "a", line: undefined, column: undefined, note: "z" },
    { source: "a", line: 1, column: undefined, note: "line" },
    { source: "a", line: 1, column: 1, note: "column" },
    { source: "b", line: undefined, column: undefined, note: "other source" },
  ]);
  expect(new Set(forward.identities)).toEqual(new Set(reverse.identities));
  expect(forward.diagnosing.addRelatedLocation({ diagnostic: forward.diagnostic.diagnostic, source: "a", note: "a" }).relation).toBe(
    forward.identities[1],
  );
  expect(forward.diagnosing._related({ diagnostic: forward.diagnostic.diagnostic })).toHaveLength(5);
});

test("source retraction and clearing have exact repeated-work lifecycle semantics", () => {
  const diagnosing = new DiagnosingConcept();
  const global = report(diagnosing, { code: "GLOBAL", source: undefined, line: undefined, column: undefined });
  const alpha = report(diagnosing, { code: "ALPHA", source: "alpha", line: undefined, column: undefined });
  const beta = report(diagnosing, { code: "BETA", source: "beta", line: undefined, column: undefined });
  diagnosing.addRelatedLocation({ diagnostic: alpha.diagnostic, source: "beta", note: "related to beta" });
  diagnosing.addRelatedLocation({ diagnostic: beta.diagnostic, source: "alpha", note: "related to alpha" });

  expect(diagnosing.retractGroup({ source: "alpha" })).toEqual({ scope: undefined, source: "alpha", count: 1 });
  expect(diagnosing._related({ diagnostic: alpha.diagnostic })).toEqual([]);
  expect(diagnosing._related({ diagnostic: beta.diagnostic })).toEqual([
    { source: "alpha", line: undefined, column: undefined, note: "related to alpha" },
  ]);
  expect(diagnosing.retractGroup({ source: "alpha" })).toEqual({ scope: undefined, source: "alpha", count: 0 });
  expect(diagnosing.retractGroup({})).toEqual({ scope: undefined, source: undefined, count: 1 });
  expect(diagnosing._related({ diagnostic: global.diagnostic })).toEqual([]);

  const recreated = report(diagnosing, {
    code: "ALPHA",
    message: "A current message.",
    source: "alpha",
    line: undefined,
    column: undefined,
  });
  expect(recreated).toEqual(alpha);
  expect(diagnosing._for({ source: "alpha" })[0]!.message).toBe("A current message.");
  expect(diagnosing._related({ diagnostic: recreated.diagnostic })).toEqual([]);
  expect(diagnosing.clear()).toEqual({ count: 2 });
  expect(diagnosing.clear()).toEqual({ count: 0 });
  expect(diagnosing._all()).toEqual([]);
  expect(diagnosing._clean()).toEqual({ clean: true });
});

test("actions reject malformed runtime values atomically and lookup queries stay total", () => {
  const diagnosing = new DiagnosingConcept();
  const kept = report(diagnosing);
  const malformed = "\ud800";

  expect(() => diagnosing.report({ severity: "info", code: 1, message: null })).toThrow(UnknownSeverity);
  for (const overrides of [
    { code: 1 },
    { message: null },
    { source: 1 },
    { source: malformed },
    { scope: malformed },
  ]) {
    expect(() => report(diagnosing, overrides)).toThrow(InvalidText);
  }
  expect(() => report(diagnosing, { message: malformed })).toThrow(InvalidText);

  for (const line of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    expect(() => report(diagnosing, { code: `line-${String(line)}`, line, column: undefined })).toThrow(InvalidLocation);
  }
  for (const column of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    expect(() => report(diagnosing, { code: `column-${String(column)}`, column })).toThrow(InvalidLocation);
  }
  expect(() => report(diagnosing, { code: "NO_SOURCE", source: undefined, line: 1, column: undefined })).toThrow(InvalidLocation);
  expect(() => report(diagnosing, { code: "NO_LINE", line: undefined, column: 1 })).toThrow(InvalidLocation);
  expect(() => report(diagnosing, { message: 1 })).toThrow(InvalidText);
  expect(diagnosing._all()).toHaveLength(1);
  expect(diagnosing._all()[0]!.message).toBe("This value has the wrong form.");

  expect(() => diagnosing.addRelatedLocation({ diagnostic: 1, source: "other", note: "note" })).toThrow(InvalidText);
  expect(() => diagnosing.addRelatedLocation({ diagnostic: kept.diagnostic, source: malformed, note: "note" })).toThrow(InvalidText);
  expect(() => diagnosing.addRelatedLocation({ diagnostic: kept.diagnostic, source: "other", note: null })).toThrow(InvalidText);
  expect(() => diagnosing.addRelatedLocation({ diagnostic: "missing", source: "other", line: 0, note: "note" })).toThrow(DiagnosticNotFound);
  expect(() => diagnosing.addRelatedLocation({ diagnostic: kept.diagnostic, source: "other", line: 0, note: "note" })).toThrow(InvalidLocation);
  expect(() => diagnosing.addRelatedLocation({ diagnostic: kept.diagnostic, source: "other", column: 1, note: "note" })).toThrow(InvalidLocation);
  expect(diagnosing._related({ diagnostic: kept.diagnostic })).toEqual([]);

  expect(() => diagnosing.retractGroup({ source: 1 })).toThrow(InvalidText);
  expect(diagnosing._all()).toHaveLength(1);
  expect(diagnosing._for({ source: 1 })).toEqual([]);
  expect(diagnosing._for({ source: malformed })).toEqual([]);
  expect(diagnosing._related({ diagnostic: 1 })).toEqual([]);
  expect(diagnosing._related({ diagnostic: malformed })).toEqual([]);
  expect(diagnosing._related({ diagnostic: "missing" })).toEqual([]);
});

test("clean is an exact one-row error gate and warnings do not close it", () => {
  const diagnosing = new DiagnosingConcept();
  expect(diagnosing._clean()).toEqual({ clean: true });
  report(diagnosing, { severity: "warning", source: undefined, line: undefined, column: undefined });
  expect(diagnosing._clean()).toEqual({ clean: true });
  report(diagnosing, { code: "BLOCKING", source: undefined, line: undefined, column: undefined });
  expect(diagnosing._clean()).toEqual({ clean: false });
  diagnosing.retractGroup({});
  expect(diagnosing._clean()).toEqual({ clean: true });
});

test("renders every standing diagnostic as one operator-readable line", () => {
  const diagnosing = new DiagnosingConcept();
  expect(diagnosing._rendered()).toEqual({ text: "No diagnostics were reported." });

  diagnosing.report({ severity: "warning", code: "SLOW", message: "This build was slow." });
  diagnosing.report({ severity: "error", code: "BROKEN", message: "This link is broken.", source: "index.md" });
  diagnosing.report({
    severity: "error",
    code: "UNDEFINED_VARIABLE",
    message: "This variable is not defined.",
    source: "about.md",
    line: 4,
    column: 2,
  });

  expect(diagnosing._rendered().text).toBe(
    [
      "ERROR UNDEFINED_VARIABLE about.md:4:2: This variable is not defined.",
      "ERROR BROKEN index.md: This link is broken.",
      "WARNING SLOW: This build was slow.",
    ].join("\n"),
  );
});

test("registry exposes every declared refusal and exact query cardinality", async () => {
  expect(registeredDiagnosing.refusals).toEqual({
    UNKNOWN_SEVERITY: UnknownSeverity,
    INVALID_TEXT: InvalidText,
    INVALID_LOCATION: InvalidLocation,
    DIAGNOSTIC_NOT_FOUND: DiagnosticNotFound,
  });
  expect(registeredDiagnosing.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["UNKNOWN_SEVERITY", "A diagnostic is an error or a warning."],
    ["INVALID_TEXT", "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."],
    ["INVALID_LOCATION", "A location needs a source; line and column must be positive safe integers, and a column needs a line."],
    ["INVALID_TEXT", "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."],
    ["DIAGNOSTIC_NOT_FOUND", "There is no such diagnostic."],
    ["INVALID_LOCATION", "A location needs a source; line and column must be positive safe integers, and a column needs a line."],
    ["INVALID_TEXT", "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."],
  ]);
  expect(registeredDiagnosing.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_all", "many"],
    ["_errors", "many"],
    ["_for", "many"],
    ["_related", "many"],
    ["_rendered", "one"],
    ["_clean", "one"],
  ]);

  const set = conceptSet({ Diagnosing: registeredDiagnosing });
  const app = assemble({ conceptSet: set, instances: set.implementations(), composition: {} });
  expect(await app.concepts.Diagnosing.report({ severity: "info", code: "X", message: "x" })).toEqual({
    error: "UNKNOWN_SEVERITY",
    detail: "A diagnostic is an error or a warning.",
  });
  expect(await app.concepts.Diagnosing.report({ severity: "error", code: 1, message: "x" })).toEqual({
    error: "INVALID_TEXT",
    detail: "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text.",
  });
  expect(await app.concepts.Diagnosing.report({ severity: "error", code: "X", message: "x", line: 1 })).toEqual({
    error: "INVALID_LOCATION",
    detail: "A location needs a source; line and column must be positive safe integers, and a column needs a line.",
  });
  expect(await app.concepts.Diagnosing.addRelatedLocation({ diagnostic: "missing", source: "other", note: "note" })).toEqual({
    error: "DIAGNOSTIC_NOT_FOUND",
    detail: "There is no such diagnostic.",
  });
  await app.whenIdle();
});
