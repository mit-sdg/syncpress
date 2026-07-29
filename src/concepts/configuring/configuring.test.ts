import { expect, test } from "bun:test";
import {
  ConfiguringConcept,
  MalformedConfiguration,
  UnsupportedNotation,
} from "./configuring.ts";

const source = `site:
  title: Ada's Notes
defaults:
  - match: "**/*.md"
    values:
      build:
        template: page.html
`;

test("its principle: YAML becomes a stable, addressable settings tree", () => {
  const configuring = new ConfiguringConcept();
  const first = configuring.load({ source, notation: "yaml" });
  expect(first.changed).toBe(true);
  expect(configuring._scalar({ node: first.root, key: "site.title", otherwise: "" })).toEqual({ value: "Ada's Notes" });

  const defaults = configuring._child({ node: first.root, key: "defaults" })[0]!;
  const rule = configuring._items({ node: defaults.child })[0]!;
  expect(configuring._scalar({ node: rule.item, key: "match", otherwise: "" })).toEqual({ value: "**/*.md" });
  expect(configuring._where({ node: rule.item }).line).toBe(4);
  expect(configuring.load({ source, notation: "yaml" })).toEqual({ ...first, changed: false });

  expect(() => configuring.load({ source: "site: [", notation: "yaml" })).toThrow(MalformedConfiguration);
  expect(configuring._active()).toEqual([{ configuration: first.configuration, root: first.root }]);
  expect(() => configuring.load({ source, notation: "toml" })).toThrow(UnsupportedNotation);
});
