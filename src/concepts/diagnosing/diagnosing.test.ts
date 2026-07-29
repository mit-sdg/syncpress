import { expect, test } from "bun:test";
import { DiagnosingConcept, UnknownSeverity } from "./diagnosing.ts";

test("its principle: diagnostics accumulate, sort, and retract by source", () => {
  const diagnosing = new DiagnosingConcept();
  const first = diagnosing.report({ severity: "error", code: "MISSING_TEMPLATE", message: "No layout is available.", source: "content/about.md", line: 2, column: 8 });
  diagnosing.relate({ diagnostic: first.diagnostic, source: "templates/page.html", line: 1, column: 1, note: "The selected template is defined here." });
  diagnosing.report({ severity: "warning", code: "MISSING_ASSET", message: "The image is not present.", source: "content/index.md", line: 4, column: 3 });
  diagnosing.report({ severity: "error", code: "INVALID_ROUTE", message: "The route is not valid.", source: "content/about.md", line: 8, column: 1 });

  expect(diagnosing._all().map(({ severity, source, line }) => ({ severity, source, line }))).toEqual([
    { severity: "error", source: "content/about.md", line: 2 },
    { severity: "error", source: "content/about.md", line: 8 },
    { severity: "warning", source: "content/index.md", line: 4 },
  ]);
  expect(diagnosing._related({ diagnostic: first.diagnostic })).toEqual([
    { source: "templates/page.html", line: 1, column: 1, note: "The selected template is defined here." },
  ]);
  expect(diagnosing._clean()).toEqual({ clean: false });
  expect(diagnosing.report({ severity: "error", code: "MISSING_TEMPLATE", message: "Changed message is ignored.", source: "content/about.md", line: 2, column: 8 })).toEqual(first);
  expect(diagnosing.retract({ source: "content/about.md" })).toEqual({ source: "content/about.md", count: 2 });
  expect(diagnosing._clean()).toEqual({ clean: true });
  expect(() => diagnosing.report({ severity: "info", code: "NOTE", message: "Not a diagnostic.", source: "site.yaml", line: 1, column: 1 })).toThrow(UnknownSeverity);
});
