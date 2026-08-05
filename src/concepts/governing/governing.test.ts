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
      paths: {
        content: "content",
        templates: "templates",
        public: "public",
        assets: "assets",
        output: "public-dist",
      },
      site: {},
      defaults: [],
      collections: [],
      markdown: {
        extensions: ["tables", "footnotes", "strikethrough", "autolinks"],
        raw: true,
        excerptSeparator: "",
      },
      images: { widths: [480, 960, 1440], formats: ["avif", "webp", "original"] },
      deploy: {
        nojekyll: true,
        requireNotFound: false,
        sitemap: false,
        redirects: [{ from: "/old/", to: "/new/" }],
        pagination: [],
      },
    },
    sources: [
      { name: "content", path: "content" },
      { name: "templates", path: "templates" },
      { name: "public", path: "public" },
    ],
  });
  result.policy.paths.output = "changed";
  expect(governing._policy()[0]?.policy.paths.output).toBe("public-dist");

  const invalidSource = [
    "paths:",
    "  output: ../outside",
    "deploy:",
    "  redirects:",
    "    /old/: /older/",
    "    /older/: /old/",
    "",
  ].join("\n");
  expect(() => governing.assess({ source: invalidSource })).toThrow("The assessed site configuration is invalid.");
  expect(governing._deployment()).toEqual([]);
  expect(governing._publishing()).toEqual([]);
  expect(governing._problems().map(({ message }) => message)).toEqual([
    "paths.output must be a portable project-relative directory path.",
    "deploy.redirects contains a cycle: /old/ -> /older/ -> /old/.",
  ]);
  const problems = governing._problems();
  expect(() => governing.assess({ source: invalidSource })).toThrow();
  expect(governing._problems()).toEqual(problems);
  problems[0]!.message = "changed";
  expect(governing._problems()[0]?.message).not.toBe("changed");
});

test("an invalid replacement exposes current problems without retaining prior state", () => {
  const governing = new GoverningConcept();
  governing.assess({ source: "deploy:\n  nojekyll: true\n" });
  expect(() => governing.assess({ source: "paths:\n  output: ../outside\n" })).toThrow();

  expect(governing._deployment()).toEqual([]);
  expect(governing._publishing()).toEqual([]);
  expect(governing._problems()).toContainEqual(expect.objectContaining({
    code: "INVALID_CONFIGURATION",
    message: "paths.output must be a portable project-relative directory path.",
  }));
});

test("reports redirect cycles as assessment problems", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({ source: "deploy:\n  redirects:\n    /old/: /older/\n    /older/: /old/\n" })).toThrow();

  expect(governing._problems()).toContainEqual(expect.objectContaining({
    message: "deploy.redirects contains a cycle: /old/ -> /older/ -> /old/.",
  }));
});

test("rejects noncanonical routes and portable paths", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({ source: 'paths:\n  output: "dist\\x01"\ndeploy:\n  redirects:\n    /../admin/: /safe/\n' })).toThrow();
  expect(governing._problems().map(({ message }) => message)).toEqual([
    "paths.output must be a portable project-relative directory path.",
    "Each redirect source must be a canonical site-relative route.",
  ]);
});

test("malformed YAML exposes no policy meaning", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({ source: "deploy:\n  nojekyll: true\ndeploy:\n  sitemap: true\n" })).toThrow();

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
  expect(() => governing.assess({ source: "paths:\n  output: []\n" })).toThrow();

  expect(governing._problems().map(({ message }) => message)).toEqual(["output must be a string."]);
});

test("invalid collection predicates never become unconditional policy", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({
    source: "collections:\n  posts:\n    match: posts/**\n    where:\n      field: data.kind\n      equals:\n        ? [unsupported]\n        : value\n",
  })).toThrow();

  expect(governing._collections()).toEqual([]);
  expect(governing._problems()).toContainEqual(expect.objectContaining({
    message: "collections.posts.where.equals must be a supported configuration value.",
  }));
});

test("unsupported nested site values cannot silently erase author data", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({
    source: "site:\n  title: Kept\n  unsupported:\n    ? [complex]\n    : value\n",
  })).toThrow();

  expect(governing._site()).toEqual([]);
  expect(governing._problems()).toContainEqual(expect.objectContaining({
    message: "site must contain only supported configuration values.",
  }));
});

test("publishing strings satisfy the deployment owner's nonempty contract", () => {
  const governing = new GoverningConcept();
  expect(() => governing.assess({
    source: [
      "deploy:",
      "  feed:",
      '    collection: ""',
      "  pagination:",
      '    "":',
      '      collection: ""',
      "      perPage: 2",
      "      route: /page/:page/",
      '      template: ""',
      "site:",
      "  origin: https://example.test",
      "",
    ].join("\n"),
  })).toThrow();

  expect(governing._publishing()).toEqual([]);
  expect(governing._problems().map(({ message }) => message)).toEqual([
    "deploy.feed.collection must not be empty.",
    "deploy.pagination names must not be empty.",
    "deploy.pagination..collection must not be empty.",
    "deploy.pagination..template must not be empty.",
  ]);
});

test("registry promises distinguish the current assessment from its problems", () => {
  expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_policy", "optional"],
    ["_paths", "optional"],
    ["_site", "optional"],
    ["_origin", "optional"],
    ["_markdown", "optional"],
    ["_images", "optional"],
    ["_defaults", "many"],
    ["_collections", "many"],
    ["_deployment", "optional"],
    ["_publishing", "optional"],
    ["_problems", "many"],
  ]);
});
