import { expect, test } from "bun:test";
import { GoverningConcept } from "./governing.ts";

test("assesses and isolates a valid publishing policy", () => {
  const governing = new GoverningConcept();
  const result = governing.assess({ source: "paths:\n  output: public-dist\ndeploy:\n  sitemap: false\n" });

  expect(result).toEqual({
    policy: {
      outputPath: "public-dist",
      deploy: {
        nojekyll: false,
        requireNotFound: false,
        sitemap: false,
        redirects: [],
        pagination: [],
      },
    },
    valid: true,
  });
  result.policy.outputPath = "changed";
  expect(governing._policy()[0]?.policy.outputPath).toBe("public-dist");
});

test("an invalid replacement exposes current problems without retaining prior state", () => {
  const governing = new GoverningConcept();
  governing.assess({ source: "deploy:\n  nojekyll: true\n" });
  const result = governing.assess({ source: "paths:\n  output: ../outside\n" });

  expect(result.valid).toBe(false);
  expect(governing._deployment()).toEqual([{ nojekyll: false, requireNotFound: false, sitemap: false }]);
  expect(governing._problems()).toContainEqual(expect.objectContaining({
    code: "INVALID_CONFIGURATION",
    message: "paths.output must be a portable project-relative directory path.",
  }));
});

test("reports redirect cycles as assessment problems", () => {
  const governing = new GoverningConcept();
  governing.assess({ source: "deploy:\n  redirects:\n    /old/: /older/\n    /older/: /old/\n" });

  expect(governing._problems()).toContainEqual(expect.objectContaining({
    message: "deploy.redirects contains a cycle: /old/ -> /older/ -> /old/.",
  }));
});
