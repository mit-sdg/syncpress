import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  AddressTaken,
  InvalidAddress,
  InvalidBase,
  InvalidOrigin,
  InvalidOwner,
  NotClaimed,
  RoutingConcept,
  type AddressKind,
} from "./routing.ts";
import { routing as routingRegistration } from "./registry.ts";

test("its principle: one owner keeps a route while the base changes only its URL", () => {
  const routing = new RoutingConcept();
  expect(routing._derive({ path: "posts/compiler-design/index.md" })).toEqual([
    { address: "/posts/compiler-design/" },
  ]);

  const page = routing.claim({ owner: "page", address: "/posts/compiler-design/" });
  expect(page.changed).toBe(true);
  expect(routing.claim({ owner: "page", address: "/posts/compiler-design/" })).toEqual({
    claim: page.claim,
    address: "/posts/compiler-design/",
    changed: false,
  });
  expect(routing._address({ owner: "page" })).toEqual([
    { address: "/posts/compiler-design/", url: "/posts/compiler-design/" },
  ]);

  expect(() => routing.claim({ owner: "other", address: "/posts/compiler-design/" })).toThrow(AddressTaken);
  expect(routing._owner({ address: "/posts/compiler-design/" })).toEqual([{ owner: "page" }]);

  routing.claim({ owner: "not-found", address: "/404.html" });
  expect(routing._file({ address: "/posts/compiler-design/" })).toEqual([
    { path: "posts/compiler-design/index.html" },
  ]);
  expect(routing._file({ address: "/404.html" })).toEqual([{ path: "404.html" }]);
  expect(
    routing._retarget({ replacement: "/posts/compiler-design/", original: "./index.md?print=1#section" }),
  ).toEqual([{ target: "/posts/compiler-design/?print=1#section" }]);

  expect(routing.rebase({ base: "/library/" })).toEqual({ base: "/library/", changed: true });
  expect(routing._address({ owner: "page" })).toEqual([
    { address: "/posts/compiler-design/", url: "/library/posts/compiler-design/" },
  ]);
  expect(routing._owner({ address: "/posts/compiler-design/" })).toEqual([{ owner: "page" }]);

  expect(routing.release({ owner: "page" })).toEqual({
    claim: page.claim,
    address: "/posts/compiler-design/",
  });
  expect(routing.claim({ owner: "other", address: "/posts/compiler-design/" }).changed).toBe(true);
});

test("derives canonical directory addresses from logical paths", () => {
  const routing = new RoutingConcept();
  const examples = new Map<unknown, string>([
    ["index.md", "/"],
    ["about.md", "/about/"],
    ["about/index.md", "/about/"],
    ["archive.tar.md", "/archive.tar/"],
    ["folder/index", "/folder/"],
    ["folder/index.tar.md", "/folder/index.tar/"],
    [".draft.md", "/.draft/"],
    [".md", "/.md/"],
    ["..md", "/..md/"],
    ["notes and #/café?.md", "/notes%20and%20%23/caf%C3%A9%3F/"],
    ["literal%/item.md", "/literal%25/item/"],
  ]);
  for (const [path, address] of examples) expect(routing._derive({ path })).toEqual([{ address }]);

  for (const path of [
    "",
    "/index.md",
    "./index.md",
    "a/../index.md",
    "a//index.md",
    "a/",
    "a\\index.md",
    "a/\u0000index.md",
    "cafe\u0301.md",
    "\ud800.md",
    1,
    null,
  ]) {
    expect(routing._derive({ path })).toEqual([]);
  }
});

test("accepts only canonical, unambiguous claimed addresses", () => {
  const routing = new RoutingConcept();
  const valid = [
    "/",
    "/about/",
    "/404.html",
    "/a:b@c/",
    "/caf%C3%A9/",
    "/a%20b/%23/",
    "/index.html/",
  ];
  for (const [index, address] of valid.entries()) {
    expect(routing.claim({ owner: `valid-${index}`, address })).toMatchObject({ address, changed: true });
  }

  routing.claim({ owner: "kept", address: "/kept/" });
  const invalid = [
    "",
    "about/",
    "//example.test/path",
    "///path",
    "/about//",
    "/about//child/",
    "/./",
    "/../",
    "/%2E/",
    "/a/%2E%2E/",
    "/a%2Fb/",
    "/a%5Cb/",
    "/a%00b/",
    "/caf%c3%a9/",
    "/%41/",
    "/café/",
    "/has space/",
    "/has#fragment/",
    "/has?query/",
    "/bad%/",
    "/bad%FF/",
    "/bad\\path/",
    "/cafe%CC%81/",
    "/index.html",
    "/nested/index.html",
  ];
  for (const address of invalid) {
    expect(() => routing.claim({ owner: "kept", address })).toThrow(InvalidAddress);
    expect(routing._address({ owner: "kept" })[0]?.address).toBe("/kept/");
    expect(routing._owner({ address })).toEqual([]);
    expect(routing._file({ address })).toEqual([]);
  }
});

test("file and address projections are exact inverses", () => {
  const routing = new RoutingConcept();
  const addresses = new Map([
    ["/", "index.html"],
    ["/about/", "about/index.html"],
    ["/404.html", "404.html"],
    ["/a%20b/caf%C3%A9/", "a b/café/index.html"],
    ["/punctuation:$&'()*+,;=@/file~.txt", "punctuation:$&'()*+,;=@/file~.txt"],
    ["/index.html/", "index.html/index.html"],
  ]);
  for (const [address, path] of addresses) {
    expect(routing._file({ address })).toEqual([{ path }]);
    expect(routing._locate({ path })).toEqual([{ address }]);
  }

  for (const path of [
    "index.html",
    "about/index.html",
    "404.html",
    "a b/café/index.html",
    "hash#tag/query?name.bin",
    "index.html/child",
    "literal%/index.html",
  ]) {
    const located = routing._locate({ path });
    expect(located).toHaveLength(1);
    expect(routing._file({ address: located[0]!.address })).toEqual([{ path }]);
  }

  for (const address of ["/index.html", "/a/index.html", "/raw café/", "/bad%2fpath/"]) {
    expect(routing._file({ address })).toEqual([]);
  }
  for (const path of ["", "/index.html", "a//index.html", "a/../index.html", "a\\index.html", "\ud800"]) {
    expect(routing._locate({ path })).toEqual([]);
  }
});

test("classifies references and projects only site-absolute targets below the base", () => {
  const routing = new RoutingConcept();
  expect(routing._url({ target: "/notes/?print=1#top" })).toEqual([{ url: "/notes/?print=1#top" }]);
  expect(routing.rebase({ base: "/library/" })).toEqual({ base: "/library/", changed: true });
  expect(routing.rebase({ base: "/library/" })).toEqual({ base: "/library/", changed: false });
  expect(routing._url({ target: "/" })).toEqual([{ url: "/library/" }]);
  expect(routing._url({ target: "/notes/?print=1#top" })).toEqual([
    { url: "/library/notes/?print=1#top" },
  ]);
  expect(routing._url({ target: "/not//a/claim?still=projected" })).toEqual([
    { url: "/library/not//a/claim?still=projected" },
  ]);

  const classifications = new Map<unknown, AddressKind>([
    ["#top", "fragment"],
    ["#", "fragment"],
    ["//cdn.example.test/x.png", "external"],
    ["https://example.test", "external"],
    ["MAILTO:ada@example.test", "external"],
    ["/about/", "absolute"],
    ["/?query", "absolute"],
    ["./x.png", "relative"],
    ["?query", "relative"],
    ["https", "relative"],
    ["", "relative"],
  ]);
  for (const [target, kind] of classifications) expect(routing._classify({ target })).toEqual([{ kind }]);

  for (const target of ["relative", "#top", "https://example.test", "//example.test/x", 1, null, "\ud800"]) {
    expect(routing._url({ target })).toEqual([]);
  }
  expect(routing._classify({ target: 1 })).toEqual([]);
  expect(routing._classify({ target: "\ud800" })).toEqual([]);
});

test("validates optional HTTP(S) origins and projects canonical absolute URLs", () => {
  const routing = new RoutingConcept();
  expect(routing._absolute({ address: "/notes/" })).toEqual([]);

  expect(routing.reorigin({ origin: "https://example.test/" })).toEqual({
    origin: "https://example.test",
    changed: true,
  });
  expect(routing.reorigin({ origin: "https://example.test" })).toEqual({
    origin: "https://example.test",
    changed: false,
  });
  expect(routing._absolute({ address: "/" })).toEqual([{ url: "https://example.test/" }]);

  routing.rebase({ base: "/library/" });
  expect(routing._absolute({ address: "/caf%C3%A9/" })).toEqual([
    { url: "https://example.test/library/caf%C3%A9/" },
  ]);
  expect(routing._absolute({ address: "/404.html" })).toEqual([
    { url: "https://example.test/library/404.html" },
  ]);
  expect(routing._absolute({ address: "/notes/?print=1" })).toEqual([]);

  const projected = [{ url: "https://example.test/library/notes/" }];
  for (const origin of [
    "",
    "https://EXAMPLE.test",
    "https://example.test:443",
    "https://example.test/path",
    "https://example.test/?query",
    "https://user@example.test",
    "ftp://example.test",
    "//example.test",
    "example.test",
    1,
    null,
    "\ud800",
  ]) {
    expect(() => routing.reorigin({ origin })).toThrow(InvalidOrigin);
    expect(routing._absolute({ address: "/notes/" })).toEqual(projected);
  }

  expect(routing.reorigin({ origin: "http://localhost:8080" })).toEqual({
    origin: "http://localhost:8080",
    changed: true,
  });
  expect(routing._absolute({ address: "/notes/" })).toEqual([
    { url: "http://localhost:8080/library/notes/" },
  ]);
  expect(routing.reorigin({})).toEqual({ origin: undefined, changed: true });
  expect(routing._absolute({ address: "/notes/" })).toEqual([]);
  expect(routing.reorigin({ origin: undefined })).toEqual({ origin: undefined, changed: false });
});

test("retargets safe relative references while preserving their exact suffix spelling", () => {
  const routing = new RoutingConcept();
  const examples: [replacement: string, original: string, target: string][] = [
    ["/about/", "./about.md?print=1#section", "/about/?print=1#section"],
    ["/about/", "../about.md", "/about/"],
    ["/404.html", "missing.html", "/404.html"],
    ["/about/", "?print=1#section", "/about/?print=1#section"],
    ["/about/", "", "/about/"],
    ["/about/", "about.md?", "/about/?"],
    ["/about/", "about.md#", "/about/#"],
    ["/about/", "about.md?#", "/about/?#"],
    ["/about/", "about.md?one?two#section?tail", "/about/?one?two#section?tail"],
    ["/about/", "about.md#section?still-fragment", "/about/#section?still-fragment"],
    ["/about/", "./a:b?escaped=%2f&unicode=cafe\u0301", "/about/?escaped=%2f&unicode=cafe\u0301"],
  ];
  for (const [replacement, original, target] of examples) {
    expect(routing._retarget({ replacement, original })).toEqual([{ target }]);
  }

  routing.rebase({ base: "/library/" });
  expect(routing._retarget({ replacement: "/about/", original: "about.md?x=%2F" })).toEqual([
    { target: "/about/?x=%2F" },
  ]);
});

test("retargeting rejects nonlocal, malformed, and ambiguous inputs without throwing", () => {
  const routing = new RoutingConcept();

  for (const replacement of [
    "about/",
    "//example.test/about/",
    "/about/?query",
    "/index.html",
    "/raw café/",
    1,
    null,
    "\ud800",
  ]) {
    expect(routing._retarget({ replacement, original: "about.md?print=1" })).toEqual([]);
  }

  for (const original of [
    "/about/?print=1",
    "//example.test/about?print=1",
    "https://example.test/about?print=1",
    "MAILTO:ada@example.test",
    "a:b?print=1",
    "1abc:about?print=1",
    ":about?print=1",
    "#section",
    "#",
    "about.md?bad%",
    "about.md?bad%2",
    "about.md?bad%GG",
    "about.md#one#two",
    "about.md?has space",
    "about.md?has\ttab",
    "about.md?has\nline",
    "about.md?has\\backslash",
    'about.md?has"quote',
    "about.md?has<angle>",
    "about.md?has[brackets]",
    "about.md?has^caret",
    "about.md?has`tick",
    "about.md?has{brace}",
    "about.md?has|pipe",
    "about.md?has\u0085control",
    "about.md?has\u200Bformat",
    "about.md?has\u00A0space",
    "about.md?has\u2028separator",
    "\ud800",
    1,
    null,
  ]) {
    expect(routing._retarget({ replacement: "/about/", original })).toEqual([]);
  }
});

test("rebasing validates atomically and preserves every claim", () => {
  const routing = new RoutingConcept();
  routing.claim({ owner: "one", address: "/one/" });
  routing.rebase({ base: "/notes/" });

  for (const base of [
    "",
    "notes/",
    "/notes",
    "/404.html",
    "//notes/",
    "/notes//",
    "/./",
    "/%2E/",
    "/raw café/",
    "/bad%/",
    "/bad\\path/",
    1,
    null,
    "\ud800",
  ]) {
    expect(() => routing.rebase({ base })).toThrow(InvalidBase);
    expect(routing._address({ owner: "one" })).toEqual([{ address: "/one/", url: "/notes/one/" }]);
  }

  expect(routing.rebase({ base: "/caf%C3%A9/" })).toEqual({ base: "/caf%C3%A9/", changed: true });
  expect(routing._address({ owner: "one" })[0]?.url).toBe("/caf%C3%A9/one/");
});

test("claim moves are atomic and claim identities survive every lifecycle change", () => {
  const routing = new RoutingConcept();
  const first = routing.claim({ owner: "a:b", address: "/first/" });
  const second = routing.claim({ owner: "a", address: "/second/" });
  expect(first.claim).not.toBe(second.claim);

  const moved = routing.claim({ owner: "a:b", address: "/moved/" });
  expect(moved).toEqual({ claim: first.claim, address: "/moved/", changed: true });
  expect(routing._owner({ address: "/first/" })).toEqual([]);

  expect(() => routing.claim({ owner: "a:b", address: "/second/" })).toThrow(AddressTaken);
  expect(routing._address({ owner: "a:b" })[0]?.address).toBe("/moved/");
  expect(routing._owner({ address: "/second/" })).toEqual([{ owner: "a" }]);

  expect(routing.release({ owner: "a:b" })).toEqual({ claim: first.claim, address: "/moved/" });
  routing.claim({ owner: "replacement", address: "/moved/" });
  const reclaimed = routing.claim({ owner: "a:b", address: "/third/" });
  expect(reclaimed.claim).toBe(first.claim);

  const separate = new RoutingConcept();
  expect(separate.claim({ owner: "a:b", address: "/elsewhere/" }).claim).toBe(first.claim);

  expect(() => routing.release({ owner: "missing" })).toThrow(NotClaimed);
  expect(routing._claims()).toContainEqual({ owner: "a:b", address: "/third/" });
});

test("lists claims in deterministic UTF-8 address order independent of arrival", () => {
  const addresses = ["/z/", "/", "/b/", "/a/", "/%C3%A9/"];
  const list = (arrival: string[]) => {
    const routing = new RoutingConcept();
    for (const address of arrival) routing.claim({ owner: `owner:${address}`, address });
    return routing._claims();
  };
  const expected = ["/", "/%C3%A9/", "/a/", "/b/", "/z/"];
  expect(list(addresses).map(({ address }) => address)).toEqual(expected);
  expect(list([...addresses].reverse()).map(({ address }) => address)).toEqual(expected);
  expect(list(addresses)).toEqual(list([...addresses].reverse()));
});

test("actions reject malformed runtime identities and lookup queries stay safe", () => {
  const routing = new RoutingConcept();
  routing.claim({ owner: "kept", address: "/kept/" });

  for (const owner of [1, null, {}, new String("kept"), "\ud800"]) {
    expect(() => routing.claim({ owner, address: "bad" })).toThrow(InvalidOwner);
    expect(() => routing.release({ owner })).toThrow(InvalidOwner);
    expect(routing._address({ owner })).toEqual([]);
  }
  expect(routing._address({ owner: "kept" })).toEqual([{ address: "/kept/", url: "/kept/" }]);

  for (const value of [1, null, {}, "\ud800"]) {
    expect(routing._derive({ path: value })).toEqual([]);
    expect(routing._owner({ address: value })).toEqual([]);
    expect(routing._file({ address: value })).toEqual([]);
    expect(routing._locate({ path: value })).toEqual([]);
    expect(routing._retarget({ replacement: value, original: "relative" })).toEqual([]);
    expect(routing._retarget({ replacement: "/relative/", original: value })).toEqual([]);
    expect(routing._url({ target: value })).toEqual([]);
    expect(routing._absolute({ address: value })).toEqual([]);
    expect(routing._classify({ target: value })).toEqual([]);
  }
  expect(routing._claims()).toEqual([{ owner: "kept", address: "/kept/" }]);
});

test("registry refusals, messages, and query promises match the standalone contract", async () => {
  expect(routingRegistration.refusals).toEqual({
    INVALID_BASE: InvalidBase,
    INVALID_ORIGIN: InvalidOrigin,
    INVALID_OWNER: InvalidOwner,
    INVALID_ADDRESS: InvalidAddress,
    ADDRESS_TAKEN: AddressTaken,
    NOT_CLAIMED: NotClaimed,
  });
  expect(
    routingRegistration.specification.actions.flatMap(({ refusals }) =>
      refusals.map(({ code, message }) => [code, message]),
    ),
  ).toEqual([
    ["INVALID_BASE", "A base must be a canonical directory address."],
    ["INVALID_ORIGIN", "An origin must be a canonical HTTP or HTTPS origin."],
    ["INVALID_OWNER", "An owner must be a well-formed text identity."],
    ["INVALID_ADDRESS", "An address must be a canonical site-absolute path."],
    ["ADDRESS_TAKEN", "Another owner has already claimed this address."],
    ["INVALID_OWNER", "An owner must be a well-formed text identity."],
    ["NOT_CLAIMED", "This owner has claimed no address."],
  ]);
  expect(routingRegistration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_derive", "optional"],
    ["_address", "optional"],
    ["_owner", "optional"],
    ["_file", "optional"],
    ["_locate", "optional"],
    ["_retarget", "optional"],
    ["_url", "optional"],
    ["_absolute", "optional"],
    ["_classify", "optional"],
    ["_claims", "many"],
  ]);

  const concepts = conceptSet({ Routing: routingRegistration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  const Routing = app.concepts.Routing;
  expect(await Routing.rebase({ base: "notes/" })).toEqual({
    error: "INVALID_BASE",
    detail: "A base must be a canonical directory address.",
  });
  expect(await Routing.reorigin({ origin: "https://example.test/path" })).toEqual({
    error: "INVALID_ORIGIN",
    detail: "An origin must be a canonical HTTP or HTTPS origin.",
  });
  expect(await Routing.claim({ owner: 1, address: "/one/" })).toEqual({
    error: "INVALID_OWNER",
    detail: "An owner must be a well-formed text identity.",
  });
  expect(await Routing.claim({ owner: "one", address: "one/" })).toEqual({
    error: "INVALID_ADDRESS",
    detail: "An address must be a canonical site-absolute path.",
  });
  await Routing.claim({ owner: "one", address: "/one/" });
  expect(await Routing.reorigin({ origin: "https://example.test/" })).toEqual({
    origin: "https://example.test",
    changed: true,
  });
  expect(await Routing._absolute({ address: "/one/" })).toEqual([{ url: "https://example.test/one/" }]);
  expect(await Routing.claim({ owner: "two", address: "/one/" })).toEqual({
    error: "ADDRESS_TAKEN",
    detail: "Another owner has already claimed this address.",
  });
  expect(await Routing.release({ owner: "missing" })).toEqual({
    error: "NOT_CLAIMED",
    detail: "This owner has claimed no address.",
  });
  await app.whenIdle();
});
