import { expect, test } from "bun:test";
import {
  DeploymentActive,
  DeployingConcept,
  InvalidContext,
  InvalidEntries,
  InvalidPolicy,
  InvalidPreparation,
  InvalidRedirect,
  InvalidUrls,
  WorkNotActive,
  WorkNotCurrent,
  WorkNotPrepared,
} from "./deploying.ts";
import { deploying as registration } from "./registry.ts";
import {
  deploymentFeedPreparation,
  deploymentRedirectDocument,
  deploymentSitemapDocument,
} from "../../compositions/deployment-computations.ts";

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
  expect(deploying._current()[0]).toMatchObject({ kind: "nojekyll", status: "active" });
  expect(() => deploying.start({ policy })).toThrow(DeploymentActive);
  const redirect = deploying.complete({ work: started.work! });

  expect(deploying._current()[0]).toMatchObject({ work: redirect.work, status: "active" });
  expect(() => deploying.complete({ work: redirect.work! })).toThrow(WorkNotPrepared);
  const redirectDocument = deploying.redirect({
    work: redirect.work!,
    target: "/new/",
    canonical: "https://example.test/new/",
    content: deploymentRedirectDocument("/new/", "https://example.test/new/"),
  });
  expect(redirectDocument.content).toContain('href="https://example.test/new/"');
  expect(deploying._current()[0]).toMatchObject({ kind: "redirect", status: "prepared" });
  const pagination = deploying.complete({ work: redirect.work! });

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
  expect(deploying._current()[0]).toMatchObject({ kind: "pagination-page", number: 1, status: "active" });

  const firstPage = deploying.context({
    work: divided.work,
    context: { pagination: { current: 1, pages: 2 } },
  });
  expect(firstPage.context).toMatchObject({ pagination: { current: 1, pages: 2 } });
  const secondPage = deploying.complete({ work: divided.work });

  expect(deploying._current()[0]).toMatchObject({ work: secondPage.work, status: "active" });
  deploying.context({ work: secondPage.work!, context: {} });
  const sitemap = deploying.complete({ work: secondPage.work! });

  const sitemapUrls = [{ url: "https://example.test/" }];
  deploying.snapshotSitemap({ work: sitemap.work!, urls: sitemapUrls });
  expect(deploying.prepareSitemap({
    work: sitemap.work!,
    content: deploymentSitemapDocument(sitemapUrls),
  }).content).toContain(
    "<loc>https://example.test/</loc>",
  );
  const feed = deploying.complete({ work: sitemap.work! });

  const feedPreparation = deploymentFeedPreparation({
    path: "feed.xml",
    title: null,
    description: null,
    site: { origin: "https://example.test", basePath: "/" },
    entries: [{ item: "first", card: { data: { title: "First", date: "2026-07-30" }, url: "/first/" } }],
  });
  expect(deploying.prepareFeed({ work: feed.work!, preparation: feedPreparation }))
    .toMatchObject({ path: "feed.xml", invalid: 0, valid: true, origin: true });
  expect(deploying.complete({ work: feed.work! })).toMatchObject({ completed: true });
  expect(deploying._current()).toEqual([]);
  expect(deploying._outcome()).toEqual({ state: "completed" });

  expect(() => deploying.start({ policy: emptyPolicy })).toThrow(DeploymentActive);
});

test("every queue transition atomically activates its returned work", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      nojekyll: true,
      sitemap: true,
      redirects: [{ from: "/one/", to: "/new/" }, { from: "/two/", to: "/new/" }],
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
      feed: { collection: "posts", path: "feed.xml" },
    },
  });
  expect(deploying._work({ work: started.work! })[0]).toMatchObject({ kind: "nojekyll", status: "active" });

  const firstRedirect = deploying.complete({ work: started.work! });
  expect(deploying._work({ work: firstRedirect.work! })[0]).toMatchObject({ kind: "redirect", status: "active" });
  expect(() => deploying.complete({ work: started.work! })).toThrow(WorkNotCurrent);

  const secondRedirect = deploying.reject({ work: firstRedirect.work! });
  expect(deploying._work({ work: secondRedirect.work! })[0]).toMatchObject({ kind: "redirect", status: "active" });
  const redirectOwner = deploying._work({ work: secondRedirect.work! })[0]!;

  const plan = deploying.rejectOwner({ owner: "owner" in redirectOwner ? redirectOwner.owner : "" });
  expect(deploying._work({ work: plan.work! })[0]).toMatchObject({ kind: "pagination-plan", status: "active" });

  const page = deploying.divide({ deployment: started.deployment, work: plan.work!, template: "template:1", entries: [] });
  expect(deploying._work({ work: page.work })[0]).toMatchObject({ kind: "pagination-page", status: "active" });
  const pageOwner = deploying._work({ work: page.work })[0]!;

  const sitemap = deploying.rejectOwner({ owner: "owner" in pageOwner ? pageOwner.owner : "" });
  expect(deploying._work({ work: sitemap.work! })[0]).toMatchObject({ kind: "sitemap", status: "active" });

  const feed = deploying.fail({ producer: "deployment:sitemap", path: "sitemap.xml", code: "FAILED", detail: "failed" });
  expect(deploying._work({ work: feed.work! })[0]).toMatchObject({ kind: "feed", status: "active" });

  expect(deploying.rejectProducer({ producer: "deployment:feed" })).toMatchObject({ completed: true });
  expect(deploying._outcome()).toEqual({ state: "failed" });
});

test("pagination division creates one page for an empty collection", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [{ name: "posts", collection: "posts", perPage: 2, route: "/page/:page/", template: "page.html" }],
    },
  });
  const divided = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });
  expect(divided.pages).toBe(1);
  expect(deploying._work({ work: divided.work })[0]).toMatchObject({ number: 1, pages: 1, address: "/page/1/", status: "active" });
});

test("pagination plan and page identities cannot collide with punctuated names", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({
    policy: {
      ...emptyPolicy,
      pagination: [
        { name: "news", collection: "news", perPage: 2, route: "/news/:page/", template: "page.html" },
        { name: "news:1", collection: "news", perPage: 2, route: "/archive/:page/", template: "page.html" },
      ],
    },
  });
  const page = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });
  deploying.context({ work: page.work, context: {} });
  const nextPlan = deploying.complete({ work: page.work });

  expect(nextPlan.work).not.toBe(page.work);
  expect(deploying._work({ work: nextPlan.work! })[0]).toMatchObject({ kind: "pagination-plan", name: "news:1" });
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
  expect(() => deploying.divide({
    deployment: started.deployment,
    work: started.work!,
    template: "template:1",
    entries: [{ item: "missing-url", card: { data: { title: "Missing URL" } } }],
  })).toThrow(InvalidEntries);
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
  expect(() => sitemap.snapshotSitemap({ work: sitemapStarted.work!, urls: ["bad"] as never })).toThrow(InvalidUrls);
  const sparseUrls = new Array(1) as Array<{ url: string }>;
  expect(() => sitemap.snapshotSitemap({ work: sitemapStarted.work!, urls: sparseUrls })).toThrow(InvalidUrls);
  expect(() => sitemap.snapshotSitemap({ work: sitemapStarted.work!, urls: [{ url: "/relative/" }] })).toThrow(InvalidUrls);
});

test("redirect preparation validates the configured target projection", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({ policy: { ...emptyPolicy, redirects: [{ from: "/old/", to: "/new/" }] } });

  expect(() => deploying.redirect({ work: started.work!, target: 1 as never, canonical: "/new/", content: "" })).toThrow(InvalidRedirect);
  expect(() => deploying.redirect({ work: started.work!, target: "/other/", canonical: "https://example.test/other/", content: "" })).toThrow(InvalidRedirect);
  expect(deploying._current()[0]).toMatchObject({ status: "active" });
  expect(deploying.redirect({
    work: started.work!,
    target: "/base/new/",
    canonical: "https://example.test/base/new/",
    content: deploymentRedirectDocument("/base/new/", "https://example.test/base/new/"),
  }).content).toContain("/base/new/");

  const external = new DeployingConcept();
  const externalStarted = external.start({
    policy: { ...emptyPolicy, redirects: [{ from: "/away/", to: "https://elsewhere.test/path" }] },
  });
  expect(() => external.redirect({
    work: externalStarted.work!,
    target: "https://elsewhere.test/other",
    canonical: "https://elsewhere.test/other",
    content: "",
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
  const divided = deploying.divide({ deployment: started.deployment, work: started.work!, template: "template:1", entries: [] });

  expect(() => deploying.context({ work: divided.work, context: { invalid: () => undefined } })).toThrow(InvalidContext);
  expect(deploying._current()[0]).toMatchObject({ work: divided.work, status: "active" });
  expect(deploying.context({ work: divided.work, context: {} })).toMatchObject({
    owner: 'deployment-owner:["pagination-page","posts",1]',
  });
});

test("invalid and originless feed projections never become prepared", () => {
  for (const preparation of [
    deploymentFeedPreparation({
      path: "feed.xml",
      title: null,
      description: null,
      site: {},
      entries: [{ item: "post", card: { url: "/post/", data: { date: "2026-08-01" } } }],
    }),
    deploymentFeedPreparation({
      path: "feed.xml",
      title: null,
      description: null,
      site: { origin: "https://example.test", basePath: "/" },
      entries: [{ item: "post", card: { url: "/post/", data: { date: "2026-02-31" } } }],
    }),
  ]) {
    const deploying = new DeployingConcept();
    const started = deploying.start({ policy: { ...emptyPolicy, feed: { collection: "posts", path: "feed.xml" } } });

    expect(deploying.prepareFeed({ work: started.work!, preparation })).toMatchObject({
      origin: preparation.origin,
      valid: preparation.valid,
    });
    expect(deploying._current()[0]).toMatchObject({ work: started.work, status: "active" });
    expect(() => deploying.complete({ work: started.work! })).toThrow(WorkNotPrepared);
    expect(deploying.prepareFeed({ work: started.work!, preparation })).toMatchObject({ path: "feed.xml" });
    expect(deploying.rejectProducer({ producer: "deployment:feed" })).toMatchObject({ completed: true });
    expect(deploying._outcome()).toEqual({ state: "failed" });
  }
});

test("successful preparation is single-use and malformed preparation leaves work active", () => {
  const deploying = new DeployingConcept();
  const started = deploying.start({ policy: { ...emptyPolicy, redirects: [{ from: "/old/", to: "/new/" }] } });
  const content = deploymentRedirectDocument("/new/", "/new/");

  expect(() => deploying.redirect({ work: started.work!, target: "/new/", canonical: "/new/", content: "\ud800" }))
    .toThrow(InvalidPreparation);
  expect(deploying._current()[0]).toMatchObject({ status: "active" });
  deploying.redirect({ work: started.work!, target: "/new/", canonical: "/new/", content });
  expect(() => deploying.redirect({ work: started.work!, target: "/new/", canonical: "/new/", content }))
    .toThrow(WorkNotActive);
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
    INVALID_PREPARATION: InvalidPreparation,
    INVALID_REDIRECT: InvalidRedirect,
    INVALID_URLS: InvalidUrls,
    WORK_NOT_ACTIVE: WorkNotActive,
    WORK_NOT_CURRENT: WorkNotCurrent,
    WORK_NOT_PREPARED: WorkNotPrepared,
  });
});
