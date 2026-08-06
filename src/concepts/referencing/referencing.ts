import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

const INVALID_TEXT_MESSAGE = "Subjects, parts, identities, HTML, and answers must be well-formed text.";
const INVALID_FORM_MESSAGE = "Answer form must be address or markup.";
const REFERENCE_NOT_FOUND_MESSAGE = "There is no such reference.";
const SOURCE_FINISHED_MESSAGE = "A finished source cannot accept a changed answer.";
const UNREPRESENTABLE_ADDRESS_MESSAGE = "This address cannot be represented as one HTML reference.";
const OVERLAPPING_MARKUP_MESSAGE = "A markup answer overlaps another markup answer.";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

export class InvalidText extends Error {
  constructor() {
    super(INVALID_TEXT_MESSAGE);
    this.name = "InvalidText";
  }
}

export class InvalidForm extends Error {
  constructor() {
    super(INVALID_FORM_MESSAGE);
    this.name = "InvalidForm";
  }
}

export class ReferenceNotFound extends Error {
  constructor() {
    super(REFERENCE_NOT_FOUND_MESSAGE);
    this.name = "ReferenceNotFound";
  }
}

export class SourceFinished extends Error {
  constructor() {
    super(SOURCE_FINISHED_MESSAGE);
    this.name = "SourceFinished";
  }
}

export class UnrepresentableAddress extends Error {
  constructor() {
    super(UNREPRESENTABLE_ADDRESS_MESSAGE);
    this.name = "UnrepresentableAddress";
  }
}

export class OverlappingMarkup extends Error {
  constructor() {
    super(OVERLAPPING_MARKUP_MESSAGE);
    this.name = "OverlappingMarkup";
  }
}

export type ReferenceForm = "address" | "markup";
export type ReferenceKind = "link" | "image" | "embed" | "download";
export type ReferenceAttribute = "href" | "src" | "srcset" | "poster";
export type ReferenceRole =
  | "hyperlink"
  | "download"
  | "base"
  | "link-resource"
  | "image"
  | "image-candidate"
  | "input-image"
  | "media-source"
  | "source-candidate"
  | "media"
  | "poster"
  | "script"
  | "frame"
  | "embedded-resource"
  | "track";

type Span = { start: number; end: number };
type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Candidate = { raw: string; start: number; end: number; index: number };
type AttributeValue = Span & { raw: string };
type Slot = {
  slot: string;
  element: string;
  attribute: ReferenceAttribute;
  value: string;
  span: Span;
};
type Reference = {
  reference: string;
  source: string;
  raw: string;
  kind: ReferenceKind;
  role: ReferenceRole;
  tag: string;
  attribute: ReferenceAttribute;
  element: string;
  slot: string;
  index: number;
  label: string;
  line: number;
  column: number;
  sourceOffset: number;
  target: Span;
  span: Span;
  attributes?: ImageAttributes;
  answer?: string;
  form?: ReferenceForm;
};
type Source = {
  source: string;
  subject: string;
  part: string;
  text: string;
  revision: number;
  slots: Slot[];
  references: Reference[];
};
type PublicReference = Pick<
  Reference,
  | "reference"
  | "raw"
  | "kind"
  | "role"
  | "tag"
  | "attribute"
  | "element"
  | "slot"
  | "index"
  | "label"
  | "line"
  | "column"
> & { attributes?: ImageAttributes };
type ImageAttributes = Readonly<Record<string, string>>;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isSerializableText(value: string): boolean {
  return isText(value) && !value.includes("\0");
}

function requireText(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidText();
}

function requireForm(value: unknown): asserts value is ReferenceForm {
  if (value !== "address" && value !== "markup") throw new InvalidForm();
}

function sourceKey(subject: string, part: string): string {
  return JSON.stringify([subject, part]);
}

function sourceID(subject: string, part: string): string {
  return JSON.stringify(["source", subject, part]);
}

function elementID(source: string, revision: number, span: Span): string {
  return JSON.stringify(["element", source, revision, span.start, span.end]);
}

function slotID(source: string, revision: number, span: Span): string {
  return JSON.stringify(["slot", source, revision, span.start, span.end]);
}

function referenceID(source: string, revision: number, slot: Span, index: number): string {
  return JSON.stringify(["reference", source, revision, slot.start, slot.end, index]);
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r" || character === "\f";
}

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function attribute(element: Element, name: string) {
  return element.attrs.find((candidate) => candidate.name.toLowerCase() === name);
}

function attributeLocation(element: Element, name: string) {
  const locations = element.sourceCodeLocation?.attrs;
  if (locations === undefined) return undefined;
  return locations[name] ?? Object.entries(locations).find(([candidate]) => candidate.toLowerCase() === name)?.[1];
}

function compareAttributeNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function authoredImageAttributes(element: Element): ImageAttributes {
  const entries: { name: string; value: string }[] = [];
  for (const item of element.attrs) {
    const name = item.name.toLowerCase();
    if (
      attributeLocation(element, name) === undefined ||
      !isSerializableText(item.value)
    ) {
      continue;
    }
    entries.push({ name, value: item.value });
  }

  entries.sort((left, right) => compareAttributeNames(left.name, right.name));
  const attributes = Object.create(null) as Record<string, string>;
  for (const { name, value } of entries) attributes[name] = value;
  return attributes;
}

function copyImageAttributes(attributes: ImageAttributes): ImageAttributes {
  const copy = Object.create(null) as Record<string, string>;
  for (const [name, value] of Object.entries(attributes)) copy[name] = value;
  return copy;
}

function completeAttributeSpan(text: string, span: Span, startTagEnd: number): Span {
  if (text.slice(span.start, span.end).includes("=")) return span;
  let cursor = span.end;
  while (cursor < startTagEnd && isWhitespace(text[cursor]!)) cursor += 1;
  if (text[cursor] !== "=") return span;
  cursor += 1;
  while (cursor < startTagEnd && isWhitespace(text[cursor]!)) cursor += 1;
  return { start: span.start, end: cursor };
}

function attributeValue(text: string, location: Span): AttributeValue {
  const source = text.slice(location.start, location.end);
  const equals = source.indexOf("=");
  if (equals === -1) return { start: location.end, end: location.end, raw: "" };

  let start = equals + 1;
  while (start < source.length && isWhitespace(source[start]!)) start += 1;
  if (start === source.length) {
    const offset = location.start + start;
    return { start: offset, end: offset, raw: "" };
  }

  const quote = source[start];
  if (quote === '"' || quote === "'") {
    start += 1;
    let end = start;
    while (end < source.length && source[end] !== quote) end += 1;
    return { start: location.start + start, end: location.start + end, raw: source.slice(start, end) };
  }

  let end = start;
  while (end < source.length && !isWhitespace(source[end]!)) end += 1;
  return { start: location.start + start, end: location.start + end, raw: source.slice(start, end) };
}

function decodeAttributeValue(value: string): string {
  const fragment = parseFragment(`<x value="${value.replace(/"/g, "&#34;")}">`);
  const element = fragment.childNodes[0];
  return element !== undefined && isElement(element) ? attribute(element, "value")?.value ?? value : value;
}

function decodedSourceOffsets(raw: string, decoded: string): number[] {
  const offsets = new Array<number>(decoded.length + 1);
  let rawIndex = 0;
  let decodedIndex = 0;

  while (rawIndex < raw.length && decodedIndex < decoded.length) {
    offsets[decodedIndex] = rawIndex;
    const rawCharacter = raw[rawIndex]!;
    const decodedCharacter = decoded[decodedIndex]!;

    if (rawCharacter === "&") {
      const suffix = decoded.slice(decodedIndex);
      let matched = false;
      const limit = Math.min(raw.length, rawIndex + 64);
      for (let end = rawIndex + 1; end <= limit; end += 1) {
        const tail = decodeAttributeValue(raw.slice(end));
        if (!suffix.endsWith(tail)) continue;
        const emitted = suffix.slice(0, suffix.length - tail.length);
        if (emitted.length === 0) continue;
        for (let index = 0; index < emitted.length; index += 1) offsets[decodedIndex + index] = rawIndex;
        decodedIndex += emitted.length;
        rawIndex = end;
        offsets[decodedIndex] = rawIndex;
        matched = true;
        break;
      }
      if (matched) continue;
    }

    if (rawCharacter === "\r" && decodedCharacter === "\n") {
      rawIndex += raw[rawIndex + 1] === "\n" ? 2 : 1;
      decodedIndex += 1;
      offsets[decodedIndex] = rawIndex;
      continue;
    }

    if (rawCharacter === "\0" && decodedCharacter === "\uFFFD") {
      rawIndex += 1;
      decodedIndex += 1;
      offsets[decodedIndex] = rawIndex;
      continue;
    }

    rawIndex += 1;
    decodedIndex += 1;
  }

  while (decodedIndex <= decoded.length) {
    offsets[decodedIndex] = rawIndex;
    decodedIndex += 1;
  }
  return offsets;
}

function validPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && /[1-9]/.test(value);
}

function validDensity(value: string): boolean {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function validDescriptors(descriptors: readonly string[]): boolean {
  let width = false;
  let density = false;
  let height = false;

  for (const descriptor of descriptors) {
    const suffix = descriptor.at(-1);
    const value = descriptor.slice(0, -1);
    if (suffix === "w" && !width && !density && validPositiveInteger(value)) {
      width = true;
    } else if (suffix === "x" && !width && !density && !height && validDensity(value)) {
      density = true;
    } else if (suffix === "h" && !height && !density && validPositiveInteger(value)) {
      height = true;
    } else {
      return false;
    }
  }
  return !height || width;
}

function collectDescriptors(value: string, cursor: number): { descriptors: string[]; cursor: number } {
  const descriptors: string[] = [];
  let current = "";
  let state: "descriptor" | "parentheses" = "descriptor";

  while (cursor < value.length) {
    const character = value[cursor]!;
    if (state === "descriptor") {
      if (isWhitespace(character)) {
        if (current.length > 0) {
          descriptors.push(current);
          current = "";
        }
      } else if (character === ",") {
        if (current.length > 0) descriptors.push(current);
        return { descriptors, cursor: cursor + 1 };
      } else {
        current += character;
        if (character === "(") state = "parentheses";
      }
    } else {
      current += character;
      if (character === ")") state = "descriptor";
    }
    cursor += 1;
  }

  if (current.length > 0) descriptors.push(current);
  return { descriptors, cursor };
}

function srcsetCandidates(value: string): Candidate[] {
  const candidates: Candidate[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    while (cursor < value.length && (isWhitespace(value[cursor]!) || value[cursor] === ",")) cursor += 1;
    if (cursor === value.length) break;

    const start = cursor;
    while (cursor < value.length && !isWhitespace(value[cursor]!)) cursor += 1;
    let end = cursor;
    let raw = value.slice(start, end);
    let descriptors: string[] = [];

    if (raw.endsWith(",")) {
      while (raw.endsWith(",")) {
        raw = raw.slice(0, -1);
        end -= 1;
      }
    } else {
      while (cursor < value.length && isWhitespace(value[cursor]!)) cursor += 1;
      const collected = collectDescriptors(value, cursor);
      descriptors = collected.descriptors;
      cursor = collected.cursor;
    }

    if (raw.length > 0 && validDescriptors(descriptors)) candidates.push({ raw, start, end, index: candidates.length });
  }

  return candidates;
}

function factsFor(element: Element, name: string): { kind: ReferenceKind; role: ReferenceRole } | undefined {
  const tag = element.tagName.toLowerCase();
  if (element.namespaceURI !== HTML_NAMESPACE) return undefined;

  if (name === "href") {
    if (tag === "a" || tag === "area") {
      return attribute(element, "download") === undefined ? { kind: "link", role: "hyperlink" } : { kind: "download", role: "download" };
    }
    if (tag === "base") return { kind: "link", role: "base" };
    if (tag === "link") return { kind: "embed", role: "link-resource" };
    return undefined;
  }

  if (name === "srcset") {
    if (tag === "img") return { kind: "image", role: "image-candidate" };
    if (tag === "source") return { kind: "image", role: "source-candidate" };
    return undefined;
  }

  if (name === "poster") return tag === "video" ? { kind: "embed", role: "poster" } : undefined;
  if (name !== "src") return undefined;
  if (tag === "img") return { kind: "image", role: "image" };
  if (tag === "input" && attribute(element, "type")?.value.toLowerCase() === "image") return { kind: "image", role: "input-image" };
  if (tag === "source") return { kind: "embed", role: "media-source" };
  if (tag === "audio" || tag === "video") return { kind: "embed", role: "media" };
  if (tag === "script") return { kind: "embed", role: "script" };
  if (tag === "iframe") return { kind: "embed", role: "frame" };
  if (tag === "embed") return { kind: "embed", role: "embedded-resource" };
  if (tag === "track") return { kind: "embed", role: "track" };
  return undefined;
}

function textOf(element: Element): string {
  let text = "";
  const visit = (nodes: ChildNode[]): void => {
    for (const node of nodes) {
      if (node.nodeName === "#text" && "value" in node) {
        text += node.value;
      } else if (isElement(node)) {
        visit(node.childNodes);
        if (node.tagName === "template") visit((node as DefaultTreeAdapterTypes.Template).content.childNodes);
      }
    }
  };
  visit(element.childNodes);
  return text;
}

function labelFor(element: Element, role: ReferenceRole): string {
  if (role === "hyperlink" || role === "download") {
    return element.tagName === "area" ? attribute(element, "alt")?.value ?? "" : textOf(element);
  }
  if (role === "image" || role === "image-candidate" || role === "input-image") return attribute(element, "alt")?.value ?? "";
  return "";
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\r") {
      if (text[index + 1] === "\n") index += 1;
      starts.push(index + 1);
    } else if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function positionAt(starts: readonly number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle]! <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: offset - starts[low]! + 1 };
}

function overlaps(left: Span, right: Span): boolean {
  return left.start < right.end && right.start < left.end;
}

function addressIsRepresentable(reference: Reference, value: string): boolean {
  if (value.includes("\0")) return false;
  return reference.attribute !== "srcset" || (value.length > 0 && !value.startsWith(",") && !value.endsWith(",") && ![...value].some(isWhitespace));
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function publicReference(reference: Reference): PublicReference {
  const { raw, kind, role, tag, attribute: name, element, slot, index, label, line, column } = reference;
  const publicRecord: PublicReference = {
    reference: reference.reference,
    raw,
    kind,
    role,
    tag,
    attribute: name,
    element,
    slot,
    index,
    label,
    line,
    column,
  };
  if (reference.attributes !== undefined) publicRecord.attributes = copyImageAttributes(reference.attributes);
  return publicRecord;
}

/** Discover and safely rewrite supported references in generated HTML. */
export class ReferencingConcept {
  readonly #sourcesByKey = new Map<string, Source>();
  readonly #sourcesByID = new Map<string, Source>();
  readonly #referencesByID = new Map<string, Reference>();
  readonly #revisionsByKey = new Map<string, number>();

  scan({ subject, part, text }: { subject: string; part: string; text: string }) {
    requireText(subject);
    requireText(part);
    requireText(text);

    const key = sourceKey(subject, part);
    const current = this.#sourcesByKey.get(key);
    const revision = (this.#revisionsByKey.get(key) ?? 0) + 1;
    const source = current?.source ?? sourceID(subject, part);
    const scanned = this.#scan(source, revision, text);
    const record: Source = { source, subject, part, text, revision, slots: scanned.slots, references: scanned.references };

    if (current !== undefined) for (const reference of current.references) this.#referencesByID.delete(reference.reference);
    for (const reference of record.references) this.#referencesByID.set(reference.reference, reference);
    this.#revisionsByKey.set(key, revision);
    this.#sourcesByKey.set(key, record);
    this.#sourcesByID.set(source, record);
    return { source, count: record.references.length, replaced: current !== undefined, completed: record.references.length === 0 };
  }

  resolve({ reference, form, value }: { reference: string; form: ReferenceForm; value: string }) {
    requireText(reference);
    requireText(value);
    requireForm(form);

    const record = this.#referencesByID.get(reference);
    if (record === undefined) throw new ReferenceNotFound();
    const source = this.#sourcesByID.get(record.source)!;
    const wasFinished = source.references.every((candidate) => candidate.answer !== undefined);
    const changed = record.form !== form || record.answer !== value;
    if (wasFinished && changed) throw new SourceFinished();
    if (form === "address" && !addressIsRepresentable(record, value)) throw new UnrepresentableAddress();
    if (
      form === "markup" &&
      source.references.some(
        (candidate) => candidate.reference !== reference && candidate.form === "markup" && candidate.answer !== undefined && overlaps(candidate.span, record.span),
      )
    ) {
      throw new OverlappingMarkup();
    }

    if (changed) {
      record.form = form;
      record.answer = value;
    }
    const isFinished = source.references.every((candidate) => candidate.answer !== undefined);
    return {
      reference,
      source: source.source,
      subject: source.subject,
      part: source.part,
      changed,
      completed: changed && !wasFinished && isFinished,
    };
  }

  drop({ subject, part }: { subject: string; part: string }) {
    requireText(subject);
    requireText(part);

    const key = sourceKey(subject, part);
    const record = this.#sourcesByKey.get(key);
    if (record !== undefined) {
      this.#sourcesByKey.delete(key);
      this.#sourcesByID.delete(record.source);
      for (const reference of record.references) this.#referencesByID.delete(reference.reference);
    }
    return { source: record?.source ?? sourceID(subject, part), count: record?.references.length ?? 0, dropped: record !== undefined };
  }

  _source({ source }: { source: string }): { subject: string; part: string }[] {
    if (!isText(source)) return [];
    const record = this.#sourcesByID.get(source);
    return record === undefined ? [] : [{ subject: record.subject, part: record.part }];
  }

  _reference({ reference }: { reference: string }): (PublicReference & { source: string })[] {
    if (!isText(reference)) return [];
    const record = this.#referencesByID.get(reference);
    return record === undefined ? [] : [{ source: record.source, ...publicReference(record) }];
  }

  _references({ source }: { source: string }): PublicReference[] {
    if (!isText(source)) return [];
    return this.#sourcesByID.get(source)?.references.map(publicReference) ?? [];
  }

  _unanswered({ source }: { source: string }): PublicReference[] {
    if (!isText(source)) return [];
    return this.#sourcesByID.get(source)?.references.filter((reference) => reference.answer === undefined).map(publicReference) ?? [];
  }

  _finished({ subject, part }: { subject: string; part: string }): { source: string; text: string }[] {
    if (!isText(subject) || !isText(part)) return [];
    const record = this.#sourcesByKey.get(sourceKey(subject, part));
    if (record === undefined || record.references.some((reference) => reference.answer === undefined)) return [];
    return [{ source: record.source, text: this.#rewrite(record) }];
  }

  #scan(source: string, revision: number, text: string): { slots: Slot[]; references: Reference[] } {
    const slots: Slot[] = [];
    const references: Reference[] = [];
    const starts = lineStarts(text);
    const seenAttributes = new Set<string>();
    const fragment = parseFragment(text, { sourceCodeLocationInfo: true });

    const visit = (nodes: ChildNode[]): void => {
      for (const node of nodes) {
        if (!isElement(node)) continue;
        const location = node.sourceCodeLocation;
        if (location !== undefined && location !== null && node.namespaceURI === HTML_NAMESPACE) {
          const elementSpan = { start: location.startOffset, end: location.endOffset };
          const element = elementID(source, revision, elementSpan);
          for (const item of node.attrs) {
            const name = item.name.toLowerCase();
            if (name !== "href" && name !== "src" && name !== "srcset" && name !== "poster") continue;
            const facts = factsFor(node, name);
            if (facts === undefined) continue;
            const located = attributeLocation(node, name);
            if (located === undefined) continue;
            const attributeSpan = completeAttributeSpan(
              text,
              { start: located.startOffset, end: located.endOffset },
              location.startTag?.endOffset ?? location.endOffset,
            );
            const seenKey = `${attributeSpan.start}:${attributeSpan.end}`;
            if (seenAttributes.has(seenKey)) continue;
            seenAttributes.add(seenKey);

            const valueLocation = attributeValue(text, attributeSpan);
            const offsets = decodedSourceOffsets(valueLocation.raw, item.value);
            const candidates = name === "srcset" ? srcsetCandidates(item.value) : [{ raw: item.value, start: 0, end: item.value.length, index: 0 }];
            if (candidates.length === 0) continue;
            const attributes = node.tagName.toLowerCase() === "img" && name === "src" ? authoredImageAttributes(node) : undefined;

            const slot = slotID(source, revision, attributeSpan);
            slots.push({ slot, element, attribute: name, value: item.value, span: attributeSpan });
            for (const candidate of candidates) {
              const sourceOffset = valueLocation.start + (offsets[candidate.start] ?? valueLocation.raw.length);
              const position = positionAt(starts, sourceOffset);
              const reference: Reference = {
                reference: referenceID(source, revision, attributeSpan, candidate.index),
                source,
                raw: candidate.raw,
                kind: facts.kind,
                role: facts.role,
                tag: node.tagName.toLowerCase(),
                attribute: name,
                element,
                slot,
                index: candidate.index,
                label: labelFor(node, facts.role),
                line: position.line,
                column: position.column,
                sourceOffset,
                target: { start: candidate.start, end: candidate.end },
                span: elementSpan,
              };
              if (attributes !== undefined) reference.attributes = attributes;
              references.push(reference);
            }
          }
        }
        visit(node.childNodes);
        if (node.tagName === "template") visit((node as DefaultTreeAdapterTypes.Template).content.childNodes);
      }
    };

    visit(fragment.childNodes);
    slots.sort((left, right) => left.span.start - right.span.start || left.span.end - right.span.end);
    references.sort(
      (left, right) =>
        left.sourceOffset - right.sourceOffset || left.span.start - right.span.start || left.index - right.index,
    );
    return { slots, references };
  }

  #rewrite(source: Source): string {
    const markup = source.references.filter((reference) => reference.form === "markup" && reference.answer !== undefined);
    const replacements: { span: Span; value: string }[] = markup.map((reference) => ({ span: reference.span, value: reference.answer! }));

    for (const slot of source.slots) {
      if (markup.some((reference) => overlaps(reference.span, slot.span))) continue;
      const answers = source.references
        .filter((reference) => reference.slot === slot.slot && reference.form === "address" && reference.answer !== undefined)
        .sort((left, right) => right.target.start - left.target.start || right.target.end - left.target.end);
      if (answers.length === 0) continue;

      const value = answers.reduce(
        (current, reference) => `${current.slice(0, reference.target.start)}${reference.answer}${current.slice(reference.target.end)}`,
        slot.value,
      );
      replacements.push({ span: slot.span, value: `${slot.attribute}="${escapeAttribute(value)}"` });
    }

    replacements.sort((left, right) => right.span.start - left.span.start || right.span.end - left.span.end);
    return replacements.reduce(
      (text, replacement) => `${text.slice(0, replacement.span.start)}${replacement.value}${text.slice(replacement.span.end)}`,
      source.text,
    );
  }
}
