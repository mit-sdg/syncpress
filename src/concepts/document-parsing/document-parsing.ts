import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Node,
} from "yaml";

const MALFORMED_ATTRIBUTES = "The attributes at the top of this document cannot be parsed.";
const DOCUMENT_NOT_FOUND = "There is no document for this subject.";
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

export class MalformedAttributes extends Error {
  constructor() {
    super(MALFORMED_ATTRIBUTES);
    this.name = "MalformedAttributes";
  }
}

export class DocumentNotFound extends Error {
  constructor() {
    super(DOCUMENT_NOT_FOUND);
    this.name = "DocumentNotFound";
  }
}

type ScalarValue = string | number | boolean | null;
type AttributeMapping = { [key: string]: AttributeValue };
type AttributeSequence = AttributeValue[];
type AttributeValue = ScalarValue | AttributeMapping | AttributeSequence;
type DocumentRecord = {
  document: string;
  subject: string;
  attributes: AttributeMapping;
  body: string;
  bodyLine: number;
};
type ParsedDocument = ReturnType<typeof parseDocument>;
type AliasState = { counter: { expansions: number }; resolving: ReadonlySet<Node> };

function malformed(): never {
  throw new MalformedAttributes();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defineValue(record: AttributeMapping, key: string, value: AttributeValue): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function isFenceLine(text: string, start: number, end: number, hasLineFeed: boolean): boolean {
  const contentEnd = hasLineFeed && end > start && text.charCodeAt(end - 1) === 0x0d ? end - 1 : end;
  return text.slice(start, contentEnd) === "---";
}

function extractFrontMatter(text: string): { source?: string; body: string; bodyLine: number } {
  const firstLineFeed = text.indexOf("\n");
  const firstLineEnd = firstLineFeed === -1 ? text.length : firstLineFeed;
  if (!isFenceLine(text, 0, firstLineEnd, firstLineFeed !== -1)) return { body: text, bodyLine: 1 };
  if (firstLineFeed === -1) malformed();

  const headerStart = firstLineFeed + 1;
  let lineStart = headerStart;
  let line = 2;
  while (lineStart <= text.length) {
    const lineFeed = text.indexOf("\n", lineStart);
    const lineEnd = lineFeed === -1 ? text.length : lineFeed;
    if (isFenceLine(text, lineStart, lineEnd, lineFeed !== -1)) {
      const bodyStart = lineFeed === -1 ? text.length : lineFeed + 1;
      return {
        source: text.slice(headerStart, lineStart),
        body: text.slice(bodyStart),
        bodyLine: line + 1,
      };
    }
    if (lineFeed === -1) break;
    lineStart = lineFeed + 1;
    line += 1;
  }
  malformed();
}

function normalizeNode(yaml: Node | null, document: ParsedDocument, aliases: AliasState): AttributeValue {
  if (isAlias(yaml)) {
    aliases.counter.expansions += 1;
    if (aliases.counter.expansions > MAX_ALIAS_EXPANSIONS) malformed();
    const target = yaml.resolve(document);
    if (target === undefined || aliases.resolving.has(target)) malformed();
    return normalizeNode(target, document, {
      counter: aliases.counter,
      resolving: new Set([...aliases.resolving, target]),
    });
  }

  const kind = isMap(yaml) ? "mapping" : isSeq(yaml) ? "sequence" : "scalar";
  if (!CORE_TAGS[kind].has(yaml?.tag)) malformed();

  if (isMap(yaml)) {
    const values: AttributeMapping = {};
    const keys = new Set<string>();
    for (const pair of yaml.items) {
      if (!isScalar(pair.key) || !CORE_TAGS.scalar.has(pair.key.tag) || typeof pair.key.value !== "string") malformed();
      const key = pair.key.value;
      if (keys.has(key)) malformed();
      keys.add(key);
      defineValue(values, key, normalizeNode(pair.value as Node | null, document, aliases));
    }
    return values;
  }

  if (isSeq(yaml)) {
    return yaml.items.map((item) => normalizeNode(item as Node | null, document, aliases));
  }

  if (isScalar(yaml)) {
    const value = yaml.value;
    if (typeof value === "bigint") {
      if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) malformed();
      return Number(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) malformed();
      return value;
    }
    if (typeof value === "string" || typeof value === "boolean" || value === null) return value;
  }

  if (yaml === null) return null;
  malformed();
}

function parseAttributes(source: string): AttributeMapping {
  try {
    const document = parseDocument(source, {
      customTags: [],
      intAsBigInt: true,
      logLevel: "silent",
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
    if (document.contents === null) return {};

    const attributes = normalizeNode(document.contents, document, {
      counter: { expansions: 0 },
      resolving: new Set(),
    });
    if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) malformed();
    return attributes;
  } catch (error) {
    if (error instanceof MalformedAttributes) throw error;
    throw new MalformedAttributes();
  }
}

function documentIdentity(subject: string): string {
  return `document:${JSON.stringify(subject)}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Separate strict YAML front matter from a document body without interpreting its attributes. */
export class DocumentParsingConcept {
  readonly #documents = new Map<string, DocumentRecord>();

  parseDocument({ subject, text }: { subject: string; text: string }) {
    const extracted = extractFrontMatter(text);
    const attributes = extracted.source === undefined ? {} : parseAttributes(extracted.source);
    const document = documentIdentity(subject);
    const record = { document, subject, attributes, body: extracted.body, bodyLine: extracted.bodyLine };
    this.#documents.set(subject, record);
    return { document, attributes: clone(attributes), body: record.body };
  }

  removeDocument({ subject }: { subject: string }) {
    const record = this.#documents.get(subject);
    if (record === undefined) throw new DocumentNotFound();
    this.#documents.delete(subject);
    return { document: record.document };
  }

  _document({ subject }: { subject: string }): { document: string; attributes: AttributeMapping; body: string; bodyLine: number }[] {
    const record = this.#documents.get(subject);
    return record === undefined
      ? []
      : [{ document: record.document, attributes: clone(record.attributes), body: record.body, bodyLine: record.bodyLine }];
  }

  _all(): { document: string; subject: string }[] {
    return [...this.#documents.values()]
      .sort((left, right) => compareText(left.subject, right.subject))
      .map(({ document, subject }) => ({ document, subject }));
  }
}
