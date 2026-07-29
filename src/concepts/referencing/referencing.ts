import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

export class ReferenceNotFound extends Error {}

type Form = "address" | "markup";
type Kind = "link" | "image" | "embed" | "download";
type Span = { start: number; end: number };
type Target = Span & { absent: boolean };
type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Reference = {
  reference: string;
  source: string;
  raw: string;
  kind: Kind;
  label: string;
  line: number;
  column: number;
  target: Target;
  span: Span;
  order: number;
  answer?: string;
  form?: Form;
};
type Source = { source: string; subject: string; part: string; text: string; references: Reference[] };
type Candidate = { raw: string; start: number; end: number };

function sourceKey(subject: string, part: string): string {
  return `${subject}\u0000${part}`;
}

function sourceID(subject: string, part: string): string {
  return `source:${subject}:${part}`;
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r" || character === "\f";
}

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function attribute(element: Element, name: string) {
  return element.attrs.find((candidate) => candidate.name === name);
}

function attributeLocation(element: Element, name: string) {
  const locations = element.sourceCodeLocation?.attrs;
  if (locations === undefined) return undefined;
  return locations[name] ?? Object.entries(locations).find(([candidate]) => candidate.toLowerCase() === name)?.[1];
}

function targetInAttribute(text: string, location: Span): Target {
  const source = text.slice(location.start, location.end);
  const equals = source.indexOf("=");
  if (equals === -1) return { start: location.end, end: location.end, absent: true };

  let start = equals + 1;
  while (start < source.length && isWhitespace(source[start]!)) start += 1;
  if (start === source.length) return { start: location.start + start, end: location.start + start, absent: false };

  const quote = source[start];
  if (quote === '"' || quote === "'") {
    start += 1;
    let end = start;
    while (end < source.length && source[end] !== quote) end += 1;
    return { start: location.start + start, end: location.start + end, absent: false };
  }

  let end = start;
  while (end < source.length && !isWhitespace(source[end]!)) end += 1;
  return { start: location.start + start, end: location.start + end, absent: false };
}

function decodeAttributeValue(value: string): string {
  const fragment = parseFragment(`<x value="${value.replace(/"/g, "&#34;")}">`);
  const element = fragment.childNodes[0];
  return element !== undefined && isElement(element) ? attribute(element, "value")?.value ?? value : value;
}

function srcsetCandidates(value: string, offset: number): Candidate[] {
  const candidates: Candidate[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    while (cursor < value.length && (isWhitespace(value[cursor]!) || value[cursor] === ",")) cursor += 1;
    if (cursor === value.length) break;

    const start = cursor;
    if (value.slice(cursor, cursor + 5).toLowerCase() === "data:") {
      while (cursor < value.length && !isWhitespace(value[cursor]!)) cursor += 1;
      let end = cursor;
      while (end > start && value[end - 1] === ",") end -= 1;
      if (end > start) candidates.push({ raw: decodeAttributeValue(value.slice(start, end)), start: offset + start, end: offset + end });
    } else {
      while (cursor < value.length && !isWhitespace(value[cursor]!) && value[cursor] !== ",") cursor += 1;
      if (cursor > start) candidates.push({ raw: decodeAttributeValue(value.slice(start, cursor)), start: offset + start, end: offset + cursor });
    }

    while (cursor < value.length && isWhitespace(value[cursor]!)) cursor += 1;
    if (value[cursor] === ",") {
      cursor += 1;
      continue;
    }
    while (cursor < value.length && value[cursor] !== ",") cursor += 1;
    if (value[cursor] === ",") cursor += 1;
  }

  return candidates;
}

function kindFor(element: Element, name: string): Kind {
  if (name === "href") {
    if (element.tagName === "a" && attribute(element, "download") !== undefined) return "download";
    return element.tagName === "link" ? "embed" : "link";
  }
  if (name === "srcset") return "image";
  if (name === "src") return element.tagName === "img" || (element.tagName === "input" && attribute(element, "type")?.value.toLowerCase() === "image") ? "image" : "embed";
  return "embed";
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

function labelFor(element: Element, name: string): string {
  if (element.tagName === "img" || (element.tagName === "input" && attribute(element, "type")?.value.toLowerCase() === "image")) return attribute(element, "alt")?.value ?? "";
  if (name === "href" && element.tagName === "a") return textOf(element);
  if (name === "href" && element.tagName === "area") return attribute(element, "alt")?.value ?? "";
  return "";
}

function overlaps(left: Span, right: Span): boolean {
  return left.start < right.end && right.start < left.end;
}

/** Record and rewrite HTML references without deciding what their targets mean. */
export class ReferencingConcept {
  readonly #sourcesByKey = new Map<string, Source>();
  readonly #sourcesByID = new Map<string, Source>();
  readonly #referencesByID = new Map<string, Reference>();
  #nextReference = 1;

  scan({ subject, part, text }: { subject: string; part: string; text: string }) {
    const key = sourceKey(subject, part);
    const current = this.#sourcesByKey.get(key);
    if (current !== undefined) for (const reference of current.references) this.#referencesByID.delete(reference.reference);

    const source = current?.source ?? sourceID(subject, part);
    const references = this.#scan(text).map((reference) => {
      const record: Reference = { reference: `reference:${this.#nextReference}`, source, order: this.#nextReference, ...reference };
      this.#nextReference += 1;
      this.#referencesByID.set(record.reference, record);
      return record;
    });
    const record = { source, subject, part, text, references };
    this.#sourcesByKey.set(key, record);
    this.#sourcesByID.set(source, record);
    return { source, count: references.length };
  }

  answer({ reference, form, value }: { reference: string; form: Form; value: string }) {
    const record = this.#referencesByID.get(reference);
    if (record === undefined) throw new ReferenceNotFound();
    record.form = form;
    record.answer = value;
    const source = this.#sourcesByID.get(record.source)!;
    return { reference, source: source.source, subject: source.subject, part: source.part };
  }

  drop({ subject, part }: { subject: string; part: string }) {
    const key = sourceKey(subject, part);
    const record = this.#sourcesByKey.get(key);
    if (record !== undefined) {
      this.#sourcesByKey.delete(key);
      this.#sourcesByID.delete(record.source);
      for (const reference of record.references) this.#referencesByID.delete(reference.reference);
    }
    return { source: record?.source ?? sourceID(subject, part) };
  }

  _source({ source }: { source: string }) {
    const record = this.#sourcesByID.get(source);
    return record === undefined ? { subject: "", part: "" } : { subject: record.subject, part: record.part };
  }

  _reference({ reference }: { reference: string }) {
    const record = this.#referencesByID.get(reference);
    return record === undefined
      ? { source: "", raw: "", kind: "", label: "", line: 0, column: 0 }
      : { source: record.source, raw: record.raw, kind: record.kind, label: record.label, line: record.line, column: record.column };
  }

  _references({ source }: { source: string }) {
    return this.#sourcesByID.get(source)?.references.map(({ reference, raw, kind, label, line, column }) => ({ reference, raw, kind, label, line, column })) ?? [];
  }

  _unanswered({ source }: { source: string }) {
    return this.#sourcesByID.get(source)?.references.filter((reference) => reference.answer === undefined).map(({ reference, raw, kind, line, column }) => ({ reference, raw, kind, line, column })) ?? [];
  }

  _finished({ subject, part }: { subject: string; part: string }) {
    const record = this.#sourcesByKey.get(sourceKey(subject, part));
    if (record === undefined || record.references.some((reference) => reference.answer === undefined)) return [];
    return [{ source: record.source, text: this.#rewrite(record) }];
  }

  #scan(text: string): Omit<Reference, "reference" | "source" | "order">[] {
    const references: Omit<Reference, "reference" | "source" | "order">[] = [];
    const fragment = parseFragment(text, { sourceCodeLocationInfo: true });
    const visit = (nodes: ChildNode[]): void => {
      for (const node of nodes) {
        if (!isElement(node)) continue;
        const location = node.sourceCodeLocation;
        if (location !== undefined && location !== null) {
          for (const item of node.attrs) {
            const name = item.name.toLowerCase();
            if (name !== "href" && name !== "src" && name !== "srcset" && name !== "poster") continue;
            const attributeSpan = attributeLocation(node, name);
            if (attributeSpan === undefined) continue;
            const target = targetInAttribute(text, { start: attributeSpan.startOffset, end: attributeSpan.endOffset });
            const span = { start: location.startOffset, end: location.endOffset };
            const kind = kindFor(node, name);
            const label = labelFor(node, name);
            if (name === "srcset") {
              const rawValue = text.slice(target.start, target.end);
              for (const candidate of srcsetCandidates(rawValue, target.start)) {
                references.push({ raw: candidate.raw, kind, label, line: attributeSpan.startLine, column: attributeSpan.startCol, target: { start: candidate.start, end: candidate.end, absent: false }, span });
              }
            } else {
              references.push({ raw: item.value, kind, label, line: attributeSpan.startLine, column: attributeSpan.startCol, target, span });
            }
          }
        }
        visit(node.childNodes);
        if (node.tagName === "template") visit((node as DefaultTreeAdapterTypes.Template).content.childNodes);
      }
    };
    visit(fragment.childNodes);
    return references;
  }

  #rewrite(source: Source): string {
    const markup = source.references
      .filter((reference) => reference.form === "markup" && reference.answer !== undefined)
      .sort((left, right) => left.span.start - right.span.start || right.span.end - left.span.end || left.order - right.order);
    const selectedMarkup: Reference[] = [];
    for (const reference of markup) if (!selectedMarkup.some((selected) => overlaps(selected.span, reference.span))) selectedMarkup.push(reference);

    const replacements = [
      ...selectedMarkup.map((reference) => ({ span: reference.span, value: reference.answer! })),
      ...source.references
        .filter((reference) => reference.form === "address" && reference.answer !== undefined && !selectedMarkup.some((markup) => overlaps(markup.span, reference.target)))
        .map((reference) => ({ span: reference.target, value: reference.target.absent ? `=${reference.answer}` : reference.answer! })),
    ].sort((left, right) => right.span.start - left.span.start || right.span.end - left.span.end);

    return replacements.reduce((text, replacement) => `${text.slice(0, replacement.span.start)}${replacement.value}${text.slice(replacement.span.end)}`, source.text);
  }
}
