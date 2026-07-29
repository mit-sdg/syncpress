import { createHash } from "node:crypto";
import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from "yaml";

export class UnsupportedNotation extends Error {}
export class MalformedConfiguration extends Error {}
export class ConfigurationNotFound extends Error {}

type NodeKind = "mapping" | "sequence" | "scalar";
type NodeRecord = {
  node: string;
  configuration: string;
  parent?: string;
  key?: string;
  index?: number;
  kind: NodeKind;
  value: unknown;
  line: number;
  column: number;
  children: string[];
};
type ConfigurationRecord = {
  configuration: string;
  source: string;
  digest: string;
  notation: string;
  root: string;
  nodes: string[];
};

function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function clone(value: unknown): unknown {
  return structuredClone(value);
}

/** Normalize YAML into a stable, location-aware tree with one active document. */
export class ConfiguringConcept {
  readonly #configurations = new Map<string, ConfigurationRecord>();
  readonly #nodes = new Map<string, NodeRecord>();
  #active?: string;

  load({ source, notation }: { source: string; notation: string }) {
    if (notation !== "yaml") throw new UnsupportedNotation();
    const nextDigest = digest(source);
    const current = this.#active === undefined ? undefined : this.#configurations.get(this.#active);
    if (current?.digest === nextDigest && current.notation === notation) {
      return { configuration: current.configuration, root: current.root, changed: false };
    }

    const lineCounter = new LineCounter();
    const document = parseDocument(source, { lineCounter, prettyErrors: false });
    if (document.errors.length > 0) throw new MalformedConfiguration();

    const configuration = `configuration:${notation}:${nextDigest}`;
    const known = this.#configurations.get(configuration);
    if (known !== undefined) {
      this.#active = configuration;
      return { configuration, root: known.root, changed: true };
    }

    const records: NodeRecord[] = [];
    const root = this.#recordNode({
      yaml: document.contents,
      configuration,
      lineCounter,
      records,
    });
    const record = { configuration, source, digest: nextDigest, notation, root, nodes: records.map(({ node }) => node) };
    for (const node of records) this.#nodes.set(node.node, node);
    this.#configurations.set(configuration, record);
    this.#active = configuration;
    return { configuration, root, changed: true };
  }

  discard({ configuration }: { configuration: string }) {
    const record = this.#configurations.get(configuration);
    if (record === undefined) throw new ConfigurationNotFound();
    for (const node of record.nodes) this.#nodes.delete(node);
    this.#configurations.delete(configuration);
    if (this.#active === configuration) this.#active = undefined;
    return { configuration };
  }

  _active(): { configuration: string; root: string }[] {
    const record = this.#active === undefined ? undefined : this.#configurations.get(this.#active);
    return record === undefined ? [] : [{ configuration: record.configuration, root: record.root }];
  }

  _child({ node, key }: { node: string; key: string }): { child: string; kind: NodeKind; value: unknown }[] {
    const record = this.#descendant(node, key);
    return record === undefined ? [] : [{ child: record.node, kind: record.kind, value: clone(record.value) }];
  }

  _scalar({ node, key, otherwise }: { node: string; key: string; otherwise: unknown }) {
    const record = this.#descendant(node, key);
    return { value: record?.kind === "scalar" ? clone(record.value) : clone(otherwise) };
  }

  _values({ node, key, otherwise }: { node: string; key: string; otherwise: unknown }) {
    const record = this.#descendant(node, key);
    return { values: record === undefined ? clone(otherwise) : clone(record.value) };
  }

  _entries({ node }: { node: string }): { key: string; child: string; value: unknown }[] {
    const record = this.#nodes.get(node);
    if (record?.kind !== "mapping") return [];
    return record.children.map((child) => {
      const entry = this.#nodes.get(child)!;
      return { key: entry.key!, child, value: clone(entry.value) };
    });
  }

  _items({ node }: { node: string }): { index: number; item: string; value: unknown }[] {
    const record = this.#nodes.get(node);
    if (record?.kind !== "sequence") return [];
    return record.children.map((item) => {
      const entry = this.#nodes.get(item)!;
      return { index: entry.index!, item, value: clone(entry.value) };
    });
  }

  _record({ node }: { node: string }) {
    return { values: clone(this.#nodes.get(node)?.value ?? {}) };
  }

  _where({ node }: { node: string }) {
    const record = this.#nodes.get(node);
    return { line: record?.line ?? 0, column: record?.column ?? 0 };
  }

  #descendant(node: string, key: string): NodeRecord | undefined {
    let current = this.#nodes.get(node);
    for (const segment of key.split(".")) {
      if (current?.kind !== "mapping") return undefined;
      current = current.children.map((child) => this.#nodes.get(child)!).find((child) => child.key === segment);
    }
    return current;
  }

  #recordNode({
    yaml,
    configuration,
    lineCounter,
    records,
    parent,
    key,
    index,
  }: {
    yaml: Node | null;
    configuration: string;
    lineCounter: LineCounter;
    records: NodeRecord[];
    parent?: string;
    key?: string;
    index?: number;
  }): string {
    const node = `${configuration}:node:${records.length}`;
    const start = yaml?.range?.[0] ?? 0;
    const position = lineCounter.linePos(start);
    const record: NodeRecord = {
      node,
      configuration,
      parent,
      key,
      index,
      kind: isMap(yaml) ? "mapping" : isSeq(yaml) ? "sequence" : "scalar",
      value: yaml === null ? null : clone(yaml.toJSON()),
      line: position.line || 1,
      column: position.col || 1,
      children: [],
    };
    records.push(record);

    if (isMap(yaml)) {
      for (const pair of yaml.items) {
        const pairKey = pair.key as Node | null;
        const childKey = isScalar(pairKey) ? String(pairKey.value) : String(pairKey?.toJSON());
        record.children.push(
          this.#recordNode({
            yaml: pair.value as Node | null,
            configuration,
            lineCounter,
            records,
            parent: node,
            key: childKey,
          }),
        );
      }
    } else if (isSeq(yaml)) {
      for (const [childIndex, child] of yaml.items.entries()) {
        record.children.push(
          this.#recordNode({
            yaml: child as Node | null,
            configuration,
            lineCounter,
            records,
            parent: node,
            index: childIndex,
          }),
        );
      }
    }
    return node;
  }
}
