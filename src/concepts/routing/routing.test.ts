import { expect, test } from "bun:test";
import { AddressTaken, InvalidAddress, InvalidBase, RoutingConcept } from "./routing.ts";

test("its principle: routes are unique and base paths affect only URLs", () => {
  const routing = new RoutingConcept();
  expect(routing._derive({ path: "posts/compiler-design/index.md" })).toEqual({ address: "/posts/compiler-design/" });
  const page = routing.claim({ owner: "page", address: "/posts/compiler-design/" });
  expect(routing._address({ owner: "page" })).toEqual([{ address: "/posts/compiler-design/", url: "/posts/compiler-design/" }]);
  expect(() => routing.claim({ owner: "other", address: "/posts/compiler-design/" })).toThrow(AddressTaken);
  expect(routing.claim({ owner: "not-found", address: "/404.html" }).changed).toBe(true);
  expect(routing._file({ address: "/posts/compiler-design/" })).toEqual({ path: "posts/compiler-design/index.html" });
  routing.rebase({ base: "/notes/" });
  expect(routing._address({ owner: "page" })[0]?.url).toBe("/notes/posts/compiler-design/");
  expect(() => routing.rebase({ base: "notes" })).toThrow(InvalidBase);
  expect(() => routing.claim({ owner: "bad", address: "posts/x" })).toThrow(InvalidAddress);
  expect(page.address).toBe("/posts/compiler-design/");
});
