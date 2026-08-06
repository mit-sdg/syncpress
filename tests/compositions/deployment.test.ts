import { expect, test } from "bun:test";
import { assembleSyncpress } from "../../src/assembly.ts";

test("queue-transition returns drive marker and sitemap work without dispatch", async () => {
  const app = assembleSyncpress();
  const started = await app.concepts.Deploying.start({
    policy: {
      nojekyll: true,
      requireNotFound: false,
      sitemap: true,
      redirects: [],
      pagination: [],
    },
  });
  expect(started).toMatchObject({ completed: false, work: expect.any(String) });

  await app.whenIdle();
  expect(await app.concepts.Deploying._current()).toEqual([]);
  expect(await app.concepts.Deploying._outcome()).toEqual({ state: "completed" });
});

test("rejections activate later work and retain every deployment diagnostic", async () => {
  const app = assembleSyncpress();
  await app.concepts.Deploying.start({
    policy: {
      nojekyll: false,
      requireNotFound: false,
      sitemap: false,
      redirects: [],
      pagination: [{
        name: "missing-pages",
        collection: "missing-pages",
        perPage: 2,
        route: "/page/:page/",
        template: "page.html",
      }],
      feed: { collection: "missing-feed", path: "feed.xml" },
    },
  });

  await app.whenIdle();
  expect(await app.concepts.Deploying._current()).toEqual([]);
  expect(await app.concepts.Deploying._outcome()).toEqual({ state: "failed" });
  expect((await app.concepts.Diagnosing._all()).map(({ code }) => code).sort()).toEqual([
    "FEED_COLLECTION_NOT_FOUND",
    "PAGINATION_COLLECTION_NOT_FOUND",
  ]);
});
