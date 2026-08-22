import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { AddressTaken, InvalidAddress, InvalidOwner, NotClaimed, RoutingConcept } from "@concepts/routing/routing.ts";
import { routing as registration } from "@concepts/routing/registry.ts";

test("its principle: claims are exclusive, movable, releasable, and stable", () => {
  const routing = new RoutingConcept();
  const first = routing.claim({ owner: "page", address: "/notes/design/" });
  expect(routing.claim({ owner: "page", address: "/notes/design/" })).toEqual({
    ...first,
    changed: false,
  });
  expect(() => routing.claim({ owner: "other", address: "/notes/design/" })).toThrow(AddressTaken);

  expect(routing.claim({ owner: "page", address: "/notes/revised/" })).toEqual({
    claim: first.claim,
    address: "/notes/revised/",
    changed: true,
  });
  expect(routing._owner({ address: "/notes/design/" })).toEqual([]);
  expect(routing.release({ owner: "page" })).toEqual({ claim: first.claim, address: "/notes/revised/" });
  expect(routing.claim({ owner: "other", address: "/notes/revised/" }).changed).toBe(true);
  expect(routing.claim({ owner: "page", address: "/notes/final/" }).claim).toBe(first.claim);
});

test("claims accept only canonical unambiguous addresses", () => {
  const routing = new RoutingConcept();
  for (const [index, address] of ["/", "/about/", "/404.html", "/caf%C3%A9/", "/a%20b/%23/"] .entries()) {
    expect(routing.claim({ owner: `valid-${index}`, address })).toMatchObject({ address, changed: true });
  }

  routing.claim({ owner: "kept", address: "/kept/" });
  for (const address of ["", "about/", "//host/path", "/about//", "/./", "/a%2Fb/", "/raw café/", "/index.html"]) {
    expect(() => routing.claim({ owner: "kept", address })).toThrow(InvalidAddress);
    expect(routing._address({ owner: "kept" })).toEqual([{ address: "/kept/" }]);
  }
});

test("claim queries are total and deterministically ordered", () => {
  const ordered = (addresses: string[]) => {
    const routing = new RoutingConcept();
    for (const address of addresses) routing.claim({ owner: `owner:${address}`, address });
    return routing._claims();
  };
  const addresses = ["/z/", "/", "/b/", "/a/", "/%C3%A9/"];
  expect(ordered(addresses).map(({ address }) => address)).toEqual(["/", "/%C3%A9/", "/a/", "/b/", "/z/"]);
  expect(ordered(addresses)).toEqual(ordered([...addresses].reverse()));

  const routing = new RoutingConcept();
  routing.claim({ owner: "kept", address: "/kept/" });
  for (const owner of [1, null, {}, new String("kept"), "\ud800"]) {
    expect(() => routing.claim({ owner, address: "/other/" })).toThrow(InvalidOwner);
    expect(() => routing.release({ owner })).toThrow(InvalidOwner);
    expect(routing._address({ owner })).toEqual([]);
  }
  expect(routing._owner({ address: "/missing/" })).toEqual([]);
  expect(() => routing.release({ owner: "missing" })).toThrow(NotClaimed);
});

test("registry exposes only claim lifecycle refusals and queries", async () => {
  expect(registration.refusals).toEqual({
    ADDRESS_TAKEN: AddressTaken,
    INVALID_ADDRESS: InvalidAddress,
    INVALID_OWNER: InvalidOwner,
    NOT_CLAIMED: NotClaimed,
  });
  expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_address", "optional"],
    ["_owner", "optional"],
    ["_claims", "many"],
  ]);

  const concepts = conceptSet({ Routing: registration });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Routing.claim({ owner: "one", address: "/one/" })).toMatchObject({ changed: true });
  expect(await app.concepts.Routing.claim({ owner: "two", address: "/one/" })).toEqual({
    error: "ADDRESS_TAKEN",
    detail: "Another owner has already claimed this address.",
  });
});
