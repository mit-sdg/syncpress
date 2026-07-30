import { expect, test } from "bun:test";
import {
  DeploymentActive,
  DeployingConcept,
  InvalidContext,
  InvalidEntries,
  InvalidPolicy,
  InvalidRedirect,
  InvalidUrls,
  WorkNotActive,
  WorkNotCurrent,
  WorkNotPending,
  WorkNotPrepared,
} from "./deploying.ts";
import { deploying as registration } from "./registry.ts";

const emptyPolicy = {
  nojekyll: false,
  requireNotFound: false,
  sitemap: false,
  redirects: [],
  pagination: [],
};

test("its principle: prepare one ordered deployment through completion", () => {
  const deploying = new DeployingConcept();
  const policy = {
    ...emptyPolicy,
    nojekyll: true,
    sitemap: true,
    redirects: [{ from: "/old/", to: "/new/" }],
    pagination: [{
      name: "posts",
      collection: "posts",
      perPage: 2,
      route: "/page/:page/",
      template: "page.html",
    }],
    feed: { collection: "posts", path: "feed.xml" },
  };
  const started = deploying.start({ policy });
  expect(deploying._current()[0]).toMatchObject({ kind: "nojekyll", status: "pending" });
  expect(() => deploying.start({ policy })).toThrow(DeploymentActive);
  expect(() => deploying.complete({ work: started.work! })).toThrow(WorkNotActive);

  deploying.dispatch({ deployment: started.deployment, work: started.work! });
  expect(() => deploying.dispatch({ deployment: started.deployment, work: started.work! })).toThrow(WorkNotPending);
  const redirect = deploying.complete({ work: started.work! });

  deploying.dispatch({ deployment: started.deployment, work: redirect.work! });
  expect(() => deploying.complete({ work: redirect.work! })).toThrow(WorkNotPrepared);
  const redirectDocument = deploying.redirect({
    work: redirect.work!,
    target: "/new/",
    canonical: "https://example.test/new/",
  });
  expect(redirectDocument.content).toContain('href="https://example.test/new/"');
  expect(deploying._current()[0]).toMatchObject({ kind: "redirect", status: "prepared" });
  const pagination = deploying.complete({ work: redirect.work! });

  deploying.dispatch({ deployment: started.deployment, work: pagination.work! });
  const divided = deploying.divide({
    deployment: started.deployment,
    work: pagination.work!,
    template: "template:1",
    entries: [
      { item: "first", card: { data: { title: "First" }, url: "/first/" } },
      { item: "second", card: { data: { title: "Second" }, url: "/second/" } },
      { item: "third", card: { data: { title: "Third" }, url: "/third/" } },
    ],
  });
  expect(divided.pages).toBe(2);
  expect(deploying._current()[0]).toMatchObject({ kind: "pagination-page", number: 1, status: "pending" });

  deploying.dispatch({ deployment: started.deployment, work: divided.work });
  const firstPage = deploying.context({
    work: divided.work,
    site: { title: "Example" },
    collections: {},
    canonicalUrl: "https://example.test/page/1/",
  });
  expect(firstPage.context).toMatchObject({ pagination: { current: 1, pages: 2 } });
  const secondPage = deploying.complete({ work: divided.work });

  deploying.dispatch({ deployment: started.deployment, work: secondPage.work! });
  deploying.context({ work: secondPage.work!, site: {}, collections: {} });
  const sitemap = deploying.complete({ work: secondPage.work! });

  deploying.dispatch({ deployment: started.deployment, work: sitemap.work! });
  expect(deploying.sitemap({ work: sitemap.work!, urls: [{ url: "https://example.test/" }] }).content).toContain(
    "<loc>https://example.test/</loc>",
  );
  const feed = deploying.complete({ work: sitemap.work! });

  deploying.dispatch({ deployment: started.deployment, work: feed.work! });
  expect(deploying.feed({
    work: feed.work!,
    site: { origin: "https://example.test", basePath: "/" },
    entries: [{ item: "first", card: { data: { title: "First", date: "2026-07-30" }, url: "/first/" } }],
  })).toMatchObject({ path: "feed.xml", invalid: 0, valid: true, origin: true });
  expect(deploying.complete({ work: feed.work! })).toMatchObject({ completed: true });
  expect(deploying._current()).toEqual([]);
  expect(deploying._outcome()).toEqual({ state: "completed" });

  const replacement = deploying.start({ policy: emptyPolicy });
  expect(replacement.completed).toBe(true);
  expect(deploying._forOwner({ owner: "deployment:redirect:/old/" })).toEqual([]);
});

test("pagination division creates one page for an empty collection", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
    },
  });
  deploying.dispatch({ deployment: started.deployment, work: started.work! });
  const divided = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });
  expect(divided.pages).toBe(1);
  expect(deploying._work({ work: divided.work })[0]).toMatchObject({ number: 1, pages: 1, address: "/page/1/" });
});

test("refuses stale work and malformed supplied facts", () => {
  const deploying = new DeployingConcept();
  expect(deploying._outcome()).toEqual({ state: "absent" });
  expect(() => deploying.start({ policy: {} as never })).toThrow(InvalidPolicy);
  expect(() => deploying.start({
    policy: {
      ...emptyPolicy,
      redirects: [{ from: "/same/", to: "/one/" }, { from: "/same/", to: "/two/" }],
    },
  })).toThrow(InvalidPolicy);
  expect(() => deploying.start({
    policy: {
      ...emptyPolicy,
      redirects: [{ from: "/one/", to: "/two/" }, { from: "/two/", to: "/one/" }],
    },
  })).toThrow(InvalidPolicy);
  expect(() => deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/", template: "page.html" }],
    },
  })).toThrow(InvalidPolicy);
  const sparseRedirects = new Array(1) as Array<{ from: string; to: string }>;
  expect(() => deploying.start({ policy: { ...emptyPolicy, redirects: sparseRedirects } })).toThrow(InvalidPolicy);

  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
    },
  });
  expect(() => deploying.complete({ work: "missing" })).toThrow(WorkNotCurrent);
  deploying.dispatch({ deployment: started.deployment, work: started.work! });
  expect(() => deploying.divide({
    deployment: started.deployment,
    work: started.work!,
    template: "template:1",
    entries: {} as never,
  })).toThrow(InvalidEntries);
  const sparseEntries = new Array(1) as Array<{ item: string; card: unknown }>;
  expect(() => deploying.divide({
    deployment: started.deployment,
    work: started.work!,
    template: "template:1",
    entries: sparseEntries,
  })).toThrow(InvalidEntries);
  deploying.reject({ work: started.work! });
  expect(deploying._work({ work: started.work! })[0]).toMatchObject({ status: "failed" });
  expect(deploying._outcome()).toEqual({ state: "failed" });

  const sitemap = new DeployingConcept();
  const sitemapStarted = sitemap.start({ policy: { ...emptyPolicy, sitemap: true } });
  sitemap.dispatch({ deployment: sitemapStarted.deployment, work: sitemapStarted.work! });
  expect(() => sitemap.sitemap({ work: sitemapStarted.work!, urls: ["bad"] as never })).toThrow(InvalidUrls);
  const sparseUrls = new Array(1) as Array<{ url: string }>;
  expect(() => sitemap.sitemap({ work: sitemapStarted.work!, urls: sparseUrls })).toThrow(InvalidUrls);
  expect(() => sitemap.sitemap({ work: sitemapStarted.work!, urls: [{ url: "/relative/" }] })).toThrow(InvalidUrls);
});

test("redirect preparation validates the configured target projection", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({ policy: { ...emptyPolicy, redirects: [{ from: "/old/", to: "/new/" }] } });
  deploying.dispatch({ deployment: started.deployment, work: started.work! });

  expect(() => deploying.redirect({ work: started.work!, target: 1 as never, canonical: "/new/" })).toThrow(InvalidRedirect);
  expect(() => deploying.redirect({ work: started.work!, target: "/other/", canonical: "https://example.test/other/" })).toThrow(InvalidRedirect);
  expect(deploying._current()[0]).toMatchObject({ status: "active" });
  expect(deploying.redirect({
    work: started.work!,
    target: "/base/new/",
    canonical: "https://example.test/base/new/",
  }).content).toContain("/base/new/");

  const external = new DeployingConcept();
  const externalStarted = external.start({
    policy: { ...emptyPolicy, redirects: [{ from: "/away/", to: "https://elsewhere.test/path" }] },
  });
  external.dispatch({ deployment: externalStarted.deployment, work: externalStarted.work! });
  expect(() => external.redirect({
    work: externalStarted.work!,
    target: "https://elsewhere.test/other",
    canonical: "https://elsewhere.test/other",
  })).toThrow(InvalidRedirect);
});

test("failed context snapshots leave pagination work active", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
    },
  });
  deploying.dispatch({ deployment: started.deployment, work: started.work! });
  const divided = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });
  deploying.dispatch({ deployment: started.deployment, work: divided.work });

  expect(() => deploying.context({ work: divided.work, site: { invalid: () => undefined }, collections: {} })).toThrow(InvalidContext);
  expect(deploying._current()[0]).toMatchObject({ work: divided.work, status: "active" });
  expect(deploying.context({ work: divided.work, site: {}, collections: {} })).toMatchObject({ owner: "deployment:pagination:posts:1" });
});

test("registry promises expose one latest deployment", () => {
  expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_work", "optional"],
    ["_forOwner", "optional"],
    ["_forProducer", "optional"],
    ["_current", "optional"],
    ["_outcome", "one"],
  ]);
  expect(registration.refusals).toEqual({
    DEPLOYMENT_ACTIVE: DeploymentActive,
    INVALID_CONTEXT: InvalidContext,
    INVALID_ENTRIES: InvalidEntries,
    INVALID_POLICY: InvalidPolicy,
    INVALID_REDIRECT: InvalidRedirect,
    INVALID_URLS: InvalidUrls,
    WORK_NOT_ACTIVE: WorkNotActive,
    WORK_NOT_CURRENT: WorkNotCurrent,
    WORK_NOT_PENDING: WorkNotPending,
    WORK_NOT_PREPARED: WorkNotPrepared,
  });
});
