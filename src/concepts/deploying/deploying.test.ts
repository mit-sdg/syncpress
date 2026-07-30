import { expect, test } from "bun:test";
import { DeployingConcept, WorkNotCurrent } from "./deploying.ts";

const emptyPolicy = {
  nojekyll: false,
  requireNotFound: false,
  sitemap: false,
  redirects: [],
  pagination: [],
};

test("sequences enabled deployment work deterministically", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      nojekyll: true,
      sitemap: true,
      redirects: [{ from: "/old/", to: "/new/" }],
    },
  });
  expect(deploying._work({ work: started.work! })[0]).toMatchObject({ kind: "nojekyll" });
  const redirect = deploying.complete({ work: started.work! });
  expect(deploying._work({ work: redirect.work! })[0]).toMatchObject({ kind: "redirect", from: "/old/" });
  const sitemap = deploying.complete({ work: redirect.work! });
  expect(deploying._work({ work: sitemap.work! })[0]).toMatchObject({ kind: "sitemap" });
  expect(deploying.complete({ work: sitemap.work! }).completed).toBe(true);
});

test("pagination division always creates an ordered first page", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
    },
  });
  const divided = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });
  expect(divided.pages).toBe(1);
  expect(deploying._work({ work: divided.work })[0]).toMatchObject({ kind: "pagination-page", number: 1, pages: 1, address: "/page/1/" });
});

test("out-of-order completion is refused", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({ policy: { ...emptyPolicy, nojekyll: true } });
  expect(() => deploying.complete({ work: "missing" })).toThrow(WorkNotCurrent);
});
