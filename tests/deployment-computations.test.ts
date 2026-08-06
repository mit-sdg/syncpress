import { expect, test } from "bun:test";
import {
  deploymentFeedPreparation,
  deploymentPaginationContext,
  deploymentRedirectDocument,
  deploymentSitemapDocument,
  deploymentTransitionWork,
} from "../src/compositions/deployment-computations.ts";

test("deployment queue transition projection recognizes only active-work returns", () => {
  for (const action of ["start", "complete", "reject", "rejectOwnerWork", "rejectProducerWork", "failWork", "expandPagination"]) {
    expect(deploymentTransitionWork(action, { deployment: "deployment:1", work: "work:1" })).toBe("work:1");
  }
  expect(deploymentTransitionWork("feed", { deployment: "deployment:1", work: "work:1" })).toBeNull();
  expect(deploymentTransitionWork("complete", { deployment: "deployment:1", completed: true })).toBeNull();
  expect(deploymentTransitionWork("complete", null)).toBeNull();
});

test("redirect and sitemap projections preserve deterministic escaped documents", () => {
  expect(deploymentRedirectDocument('/next/?a=1&b="two"', "https://example.test/next/?a=1&b=two")).toBe(
    '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/next/?a=1&amp;b=&quot;two&quot;"><link rel="canonical" href="https://example.test/next/?a=1&amp;b=two"></head><body><p>Moved to <a href="/next/?a=1&amp;b=&quot;two&quot;">/next/?a=1&amp;b=&quot;two&quot;</a>.</p></body></html>\n',
  );
  expect(deploymentSitemapDocument([{ url: "https://example.test/?a=1&b=2" }, { url: "https://example.test/\x01" }])).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.test/?a=1&amp;b=2</loc></url><url><loc>https://example.test/\uFFFD</loc></url></urlset>\n',
  );
});

test("pagination projection owns body escaping and the complete rendering context", () => {
  expect(deploymentPaginationContext({
    site: { title: "Example" },
    collections: { posts: [] },
    address: "/journal/2/",
    canonicalUrl: "https://example.test/journal/2/",
    sourcePath: "[generated]/journal/2",
    title: "Journal",
    collection: "posts",
    number: 2,
    pages: 3,
    cards: [{ data: { title: "A & B" }, url: "/a/?x=1&y=2", excerpt: "<strong>Trusted</strong>" }],
    previous: "/journal/1/",
    next: "/journal/3/",
  })).toEqual({
    site: { title: "Example" },
    collections: { posts: [] },
    page: {
      data: { section: "Collection page", title: "Journal", description: "" },
      url: "/journal/2/",
      canonicalUrl: "https://example.test/journal/2/",
      source: { path: "[generated]/journal/2" },
      content: '<ul class="syncpress-pagination-items"><li><a href="/a/?x=1&amp;y=2">A &amp; B</a><div><strong>Trusted</strong></div></li></ul>',
    },
    pagination: {
      collection: "posts",
      current: 2,
      pages: 3,
      items: [{ data: { title: "A & B" }, url: "/a/?x=1&y=2", excerpt: "<strong>Trusted</strong>" }],
      previous: "/journal/1/",
      next: "/journal/3/",
    },
  });
});

test("Atom projection reports readiness without throwing or hiding invalid entries", () => {
  const valid = deploymentFeedPreparation({
    path: "feeds/index.html",
    title: null,
    description: null,
    site: { origin: "https://example.test", basePath: "/docs/", title: "Notes", description: "Updates & notes" },
    entries: [{
      item: "post",
      card: { data: { title: "First <post>", date: "2026-08-01" }, url: "/post/", excerpt: "A & B" },
    }],
  });
  expect(valid).toMatchObject({ path: "feeds/index.html", invalid: 0, valid: true, origin: true });
  expect(valid.content).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>https://example.test/docs/feeds/index.html</id><title>Notes</title><subtitle>Updates &amp; notes</subtitle><updated>2026-08-01T00:00:00Z</updated><link href="https://example.test/docs/feeds/index.html"/><entry><id>https://example.test/docs/post/</id><title>First &lt;post&gt;</title><link href="https://example.test/docs/post/"/><updated>2026-08-01T00:00:00Z</updated><summary type="html">A &amp; B</summary></entry></feed>\n',
  );

  expect(deploymentFeedPreparation({
    path: "feed.xml",
    title: "\x01",
    description: null,
    site: {},
    entries: [{ item: "post", card: { data: { date: "2026-02-31" } } }],
  })).toMatchObject({ invalid: 1, valid: false, origin: false, content: expect.stringContaining("<title>\uFFFD</title>") });
  expect(() => deploymentFeedPreparation({ path: "\ud800", title: null, description: null, site: null, entries: {} }))
    .not.toThrow();
});
