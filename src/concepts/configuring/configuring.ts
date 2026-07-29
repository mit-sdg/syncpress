import { createHash } from "node:crypto";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node,
} from "yaml";

const UNSUPPORTED_NOTATION = "This configuration notation is not supported.";
const MALFORMED_CONFIGURATION = "This configuration document cannot be parsed.";
const CONFIGURATION_NOT_FOUND = "There is no such configuration.";
const MAX_ALIAS_EXPANSIONS = 100;
const CORE_TAGS = {
  mapping: new Set([undefined, "tag:yaml.org,2002:map"]),
  sequence: new Set([undefined, "tag:yaml.org,2002:seq"]),
  scalar: new Set([
    undefined,
    "tag:yaml.org,2002:str",
    "tag:yaml.org,2002:null",
    "tag:yaml.org,2002:bool",
    "tag:yaml.org,2002:int",
    "tag:yaml.org,2002:float",
  ]),
} as const;

export class UnsupportedNotation extends Error {
  constructor() {
    super(UNSUPPORTED_NOTATION);
    this.name = "UnsupportedNotation";
  }
}

export class MalformedConfiguration extends Error {
  constructor() {
    super(MALFORMED_CONFIGURATION);
    this.name = "MalformedConfiguration";
  }
}

export class ConfigurationNotFound extends Error {
  constructor() {
    super(CONFIGURATION_NOT_FOUND);
    this.name = "ConfigurationNotFound";
  }
}

type ScalarValue = string | number | boolean | null;
type MappingValue = { [key: string]: NormalizedValue };
type SequenceValue = NormalizedValue[];
type Values = MappingValue | SequenceValue;
type NormalizedValue = ScalarValue | Values;
type NodeKind = "mapping" | "sequence" | "scalar";
type NodeRecord = {
  node: string;
  configuration: string;
  parent?: string;
  key?: string;
  index?: number;
  kind: NodeKind;
  value: NormalizedValue;
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
type ParsedDocument = ReturnType<typeof parseDocument>;
type AliasState = { counter: { expansions: number }; resolving: ReadonlySet<Node> };

function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defineValue(record: MappingValue, key: string, value: NormalizedValue): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function malformed(): never {
  throw new MalformedConfiguration();
}

/** Normalize one strict YAML document into a stable, location-aware settings tree. */
export class ConfiguringConcept {
  readonly #configurations = new Map<string, ConfigurationRecord>();
  readonly #nodes = new Map<string, NodeRecord>();
  #active?: string;

  load({ source, notation }: { source: string; notation: string }) {
    if (notation !== "yaml") throw new UnsupportedNotation();
    const nextDigest = digest(source);
    const current = this.#active === undefined ? undefined : this.#configurations.get(this.#active);
    if (current?.source === source && current.notation === notation) {
      return { configuration: current.configuration, root: current.root, changed: false };
    }

    const configuration = `configuration:${notation}:${nextDigest}`;
    const known = this.#configurations.get(configuration);
    if (known !== undefined && known.source === source && known.notation === notation) {
      this.#active = configuration;
      return { configuration, root: known.root, changed: true };
    }

    try {
      const lineCounter = new LineCounter();
      const document = parseDocument(source, {
        customTags: [],
        intAsBigInt: true,
        lineCounter,
        merge: false,
        prettyErrors: false,
        resolveKnownTags: false,
        schema: "core",
        strict: true,
        uniqueKeys: true,
        version: "1.2",
      });
      if (
        document.errors.length > 0 ||
        document.warnings.length > 0 ||
        document.directives.yaml.version !== "1.2"
      ) {
        malformed();
      }

      const records: NodeRecord[] = [];
      const root = this.#recordNode({
        yaml: document.contents,
        configuration,
        document,
        lineCounter,
        records,
        aliases: { counter: { expansions: 0 }, resolving: new Set() },
      });
      const record = {
        configuration,
        source,
        digest: nextDigest,
        notation,
        root: root.node,
        nodes: records.map(({ node }) => node),
      };
      for (const node of records) this.#nodes.set(node.node, node);
      this.#configurations.set(configuration, record);
      this.#active = configuration;
      return { configuration, root: root.node, changed: true };
    } catch (error) {
      if (error instanceof MalformedConfiguration) throw error;
      throw new MalformedConfiguration();
    }
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

  _child({ node, key }: { node: string; key: string }): { child: string; kind: NodeKind; value: NormalizedValue }[] {
    const record = this.#literalChild(this.#nodes.get(node), key);
    return record === undefined ? [] : [{ child: record.node, kind: record.kind, value: clone(record.value) }];
  }

  _at({ node, path }: { node: string; path: readonly string[] }): { found: string; kind: NodeKind; value: NormalizedValue }[] {
    const origin = this.#nodes.get(node);
    if (origin === undefined) return [];
    const record = this.#at(origin, path);
    return record === undefined ? [] : [{ found: record.node, kind: record.kind, value: clone(record.value) }];
  }

  _scalar({ node, path, otherwise }: { node: string; path: readonly string[]; otherwise: ScalarValue }): { value: ScalarValue }[] {
    const origin = this.#nodes.get(node);
    if (origin === undefined) return [];
    const record = this.#at(origin, path);
    return [{ value: record?.kind === "scalar" ? clone(record.value as ScalarValue) : clone(otherwise) }];
  }

  _values({ node, path, otherwise }: { node: string; path: readonly string[]; otherwise: Values }): { values: Values }[] {
    const origin = this.#nodes.get(node);
    if (origin === undefined) return [];
    const record = this.#at(origin, path);
    return [{ values: record !== undefined && record.kind !== "scalar" ? clone(record.value as Values) : clone(otherwise) }];
  }

  _entries({ node }: { node: string }): { key: string; child: string; value: NormalizedValue }[] {
    const record = this.#nodes.get(node);
    if (record?.kind !== "mapping") return [];
    return record.children.map((child) => {
      const entry = this.#nodes.get(child)!;
      return { key: entry.key!, child, value: clone(entry.value) };
    });
  }

  _items({ node }: { node: string }): { index: number; item: string; value: NormalizedValue }[] {
    const record = this.#nodes.get(node);
    if (record?.kind !== "sequence") return [];
    return record.children.map((item) => {
      const entry = this.#nodes.get(item)!;
      return { index: entry.index!, item, value: clone(entry.value) };
    });
  }

  _record({ node }: { node: string }): { values: MappingValue }[] {
    const record = this.#nodes.get(node);
    return record?.kind === "mapping" ? [{ values: clone(record.value as MappingValue) }] : [];
  }

  _where({ node }: { node: string }): { line: number; column: number }[] {
    const record = this.#nodes.get(node);
    return record === undefined ? [] : [{ line: record.line, column: record.column }];
  }

  #literalChild(record: NodeRecord | undefined, key: string): NodeRecord | undefined {
    if (record?.kind !== "mapping") return undefined;
    return record.children.map((child) => this.#nodes.get(child)!).find((child) => child.key === key);
  }

  #at(origin: NodeRecord, path: readonly string[]): NodeRecord | undefined {
    if (!Array.isArray(path) || path.some((segment) => typeof segment !== "string")) return undefined;
    let current: NodeRecord | undefined = origin;
    for (const segment of path) current = this.#literalChild(current, segment);
    return current;
  }

  #recordNode({
    yaml,
    configuration,
    document,
    lineCounter,
    records,
    aliases,
    parent,
    key,
    index,
    location = yaml,
  }: {
    yaml: Node | null;
    configuration: string;
    document: ParsedDocument;
    lineCounter: LineCounter;
    records: NodeRecord[];
    aliases: AliasState;
    parent?: string;
    key?: string;
    index?: number;
    location?: Node | null;
  }): NodeRecord {
    if (isAlias(yaml)) {
      aliases.counter.expansions += 1;
      if (aliases.counter.expansions > MAX_ALIAS_EXPANSIONS) malformed();
      const target = yaml.resolve(document);
      if (target === undefined || aliases.resolving.has(target)) malformed();
      return this.#recordNode({
        yaml: target,
        configuration,
        document,
        lineCounter,
        records,
        aliases: { counter: aliases.counter, resolving: new Set([...aliases.resolving, target]) },
        parent,
        key,
        index,
        location: yaml,
      });
    }

    const kind: NodeKind = isMap(yaml) ? "mapping" : isSeq(yaml) ? "sequence" : "scalar";
    if (!CORE_TAGS[kind].has(yaml?.tag)) malformed();
    const node = `${configuration}:node:${records.length}`;
    const start = location?.range?.[0] ?? 0;
    const position = lineCounter.linePos(start);
    const record: NodeRecord = {
      node,
      configuration,
      parent,
      key,
      index,
      kind,
      value: null,
      line: position.line,
      column: position.col,
      children: [],
    };
    records.push(record);

    if (isMap(yaml)) {
      const values: MappingValue = {};
      const keys = new Set<string>();
      for (const pair of yaml.items) {
        if (!isScalar(pair.key) || !CORE_TAGS.scalar.has(pair.key.tag) || typeof pair.key.value !== "string") malformed();
        const childKey = pair.key.value;
        if (keys.has(childKey)) malformed();
        keys.add(childKey);
        const child = this.#recordNode({
          yaml: pair.value as Node | null,
          configuration,
          document,
          lineCounter,
          records,
          aliases,
          parent: node,
          key: childKey,
        });
        record.children.push(child.node);
        defineValue(values, childKey, child.value);
      }
      record.value = values;
    } else if (isSeq(yaml)) {
      const values: SequenceValue = [];
      for (const [childIndex, childYaml] of yaml.items.entries()) {
        const child = this.#recordNode({
          yaml: childYaml as Node | null,
          configuration,
          document,
          lineCounter,
          records,
          aliases,
          parent: node,
          index: childIndex,
        });
        record.children.push(child.node);
        values.push(child.value);
      }
      record.value = values;
    } else if (isScalar(yaml)) {
      record.value = this.#scalarValue(yaml.value);
    } else if (yaml === null) {
      record.value = null;
    } else {
      malformed();
    }
    return record;
  }

  #scalarValue(value: unknown): ScalarValue {
    if (typeof value === "bigint") {
      if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) malformed();
      return Number(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) malformed();
      return value;
    }
    if (typeof value === "string" || typeof value === "boolean" || value === null) return value;
    malformed();
  }
}
