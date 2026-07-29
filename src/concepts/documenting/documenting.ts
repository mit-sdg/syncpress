import { parseDocument } from "yaml";

export class MalformedAttributes extends Error {}
export class DocumentNotFound extends Error {}

type DocumentRecord = { document: string; subject: string; attributes: Record<string, unknown>; body: string; bodyLine: number };

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseFrontMatter(text: string): { attributes: Record<string, unknown>; body: string; bodyLine: number } {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { attributes: {}, body: text, bodyLine: 1 };

  const end = lines.slice(1).findIndex((line) => line.trim() === "---" || line.trim() === "...");
  if (end === -1) throw new MalformedAttributes();
  const document = parseDocument(lines.slice(1, end + 1).join("\n"), { prettyErrors: false });
  if (document.errors.length > 0) throw new MalformedAttributes();
  const attributes = document.toJS();
  if (attributes !== null && (typeof attributes !== "object" || Array.isArray(attributes))) throw new MalformedAttributes();
  return {
    attributes: (attributes ?? {}) as Record<string, unknown>,
    body: lines.slice(end + 2).join("\n"),
    bodyLine: end + 3,
  };
}

/** Parse front matter without interpreting the attributes it contains. */
export class DocumentingConcept {
  readonly #documents = new Map<string, DocumentRecord>();

  parse({ subject, text }: { subject: string; text: string }) {
    const parsed = parseFrontMatter(text);
    const document = `document:${subject}`;
    this.#documents.set(subject, { document, subject, ...parsed });
    return { document, attributes: structuredClone(parsed.attributes), body: parsed.body };
  }

  forget({ subject }: { subject: string }) {
    const record = this.#documents.get(subject);
    if (record === undefined) throw new DocumentNotFound();
    this.#documents.delete(subject);
    return { document: record.document };
  }

  _document({ subject }: { subject: string }): { document: string; attributes: Record<string, unknown>; body: string; bodyLine: number }[] {
    const record = this.#documents.get(subject);
    return record === undefined
      ? []
      : [{ document: record.document, attributes: structuredClone(record.attributes), body: record.body, bodyLine: record.bodyLine }];
  }

  _all(): { document: string; subject: string }[] {
    return [...this.#documents.values()]
      .sort((left, right) => compareText(left.subject, right.subject))
      .map(({ document, subject }) => ({ document, subject }));
  }
}
