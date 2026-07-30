import { expect, test } from "bun:test";
import { parseSitePolicy } from "./site-policy.ts";

test("deployment redirects use the routing canonical-address contract", () => {
  const { problems } = parseSitePolicy(`
deploy:
  redirects:
    /../admin/: /safe/
`);

  expect(problems).toContainEqual(expect.objectContaining({
    code: "INVALID_CONFIGURATION",
    message: "Each redirect source must be a canonical site-relative route.",
  }));
});

test("deployment redirect cycles are rejected before source staging", () => {
  const { problems } = parseSitePolicy(`
deploy:
  redirects:
    /old/: /older/
    /older/: /old/
`);

  expect(problems).toContainEqual(expect.objectContaining({
    code: "INVALID_CONFIGURATION",
    message: "deploy.redirects contains a cycle: /old/ -> /older/ -> /old/.",
  }));
});

test("portable output paths reject control characters", () => {
  const { problems } = parseSitePolicy(`
paths:
  output: "dist\\x01"
`);

  expect(problems).toContainEqual(expect.objectContaining({
    code: "INVALID_CONFIGURATION",
    message: "paths.output must be a portable project-relative directory path.",
  }));
});
