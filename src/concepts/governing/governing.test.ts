import { expect, test } from "bun:test";
import { GoverningConcept } from "./governing.ts";
import { governing as registration } from "./registry.ts";

test("its principle: replace one isolated, location-aware policy assessment", () => {
  const governing = new GoverningConcept();
  const validSource = [
    "paths:",
    "  output: public-dist",
    "deploy:",
    "  nojekyll: true",
    "  redirects:",
    "    /old/: /new/",
    "",
  ].join("\n");
  const result = governing.assess({ source: validSource });

  expect(result).toEqual({
    policy: {
      outputPath: "public-dist",
      deploy: {
        nojekyll: true,
        requireNotFound: false,
        sitemap: false,
        redirects: [{ from: "/old/", to: "/new/" }],
        pagination: [],
      },
    },
    valid: true,
  });
  result.policy.outputPath = "changed";
  expect(governing._policy()[0]?.policy.outputPath).toBe("public-dist");

  const invalidSource = [
    "paths:",
    "  output: ../outside",
    "deploy:",
    "  redirects:",
    "    /old/: /older/",
    "    /older/: /old/",
    "",
  ].join("\n");
  expect(governing.assess({ source: invalidSource }).valid).toBe(false);
  expect(governing._deployment()).toEqual([]);
  expect(governing._publishing()).toEqual([]);
  expect(governing._problems().map(({ message }) => message)).toEqual([
    "paths.output must be a portable project-relative directory path.",
    "deploy.redirects contains a cycle: /old/ -> /older/ -> /old/.",
  ]);
  const problems = governing._problems();
  governing.assess({ source: invalidSource });
  expect(governing._problems()).toEqual(problems);
  problems[0]!.message = "changed";
  expect(governing._problems()[0]?.message).not.toBe("changed");
});

test("an invalid replacement exposes current problems without retaining prior state", () => {
  const governing = new GoverningConcept();
  governing.assess({ source: "deploy:\n  nojekyll: true\n" });
  const result = governing.assess({ source: "paths:\n  output: ../outside\n" });

  expect(result.valid).toBe(false);
  expect(governing._deployment()).toEqual([]);
  expect(governing._publishing()).toEqual([]);
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

test("malformed YAML exposes no policy meaning", () => {
  const governing = new GoverningConcept();
  const result = governing.assess({ source: "deploy:\n  nojekyll: true\ndeploy:\n  sitemap: true\n" });

  expect(result.valid).toBe(false);
  expect(governing._publishing()).toEqual([]);
  expect(governing._problems()).toEqual([
    expect.objectContaining({
      code: "INVALID_CONFIGURATION",
      message: expect.stringContaining("Map keys must be unique"),
      line: 3,
    }),
  ]);
});

test("reports an invalid output setting once", () => {
  const governing = new GoverningConcept();
  governing.assess({ source: "paths:\n  output: []\n" });

  expect(governing._problems().map(({ message }) => message)).toEqual(["output must be a string."]);
});

test("registry promises distinguish the current assessment from its problems", () => {
  expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_policy", "optional"],
    ["_deployment", "optional"],
    ["_publishing", "optional"],
    ["_problems", "many"],
  ]);
});
