import { createHash } from "node:crypto";
import { marked } from "marked";

export class DialectNotFound extends Error {}
export class ConversionFailed extends Error {}

type Dialect = { dialect: string; name: string; extensions: string[]; raw: boolean; separator: string };
type Conversion = { conversion: string; subject: string; part: string; dialect: string; digest: string; output: string; excerpt?: string };

function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function conversionKey(subject: string, part: string): string {
  return `${subject}\u0000${part}`;
}

/** Convert declared markup dialects while retaining content-addressed results. */
export class ConvertingConcept {
  readonly #dialectsByName = new Map<string, Dialect>();
  readonly #dialectsByID = new Map<string, Dialect>();
  readonly #conversionsByKey = new Map<string, Conversion>();
  readonly #conversionsByID = new Map<string, Conversion>();

  declare({ name, extensions, raw, separator }: { name: string; extensions: string[]; raw: boolean; separator: string }) {
    const settings = JSON.stringify({ extensions, raw, separator });
    const current = this.#dialectsByName.get(name);
    if (current !== undefined && JSON.stringify({ extensions: current.extensions, raw: current.raw, separator: current.separator }) === settings) {
      return { dialect: current.dialect, changed: false };
    }
    const dialect = `dialect:${name}:${digest(settings)}`;
    const record = { dialect, name, extensions: [...extensions], raw, separator };
    this.#dialectsByName.set(name, record);
    this.#dialectsByID.set(dialect, record);
    return { dialect, changed: true };
  }

  convert({ subject, part, dialect, source }: { subject: string; part: string; dialect: string; source: string }) {
    const selected = this.#dialectsByID.get(dialect);
    if (selected === undefined) throw new DialectNotFound();
    const sourceDigest = digest(source);
    const key = conversionKey(subject, part);
    const current = this.#conversionsByKey.get(key);
    if (current?.dialect === dialect && current.digest === sourceDigest) return { conversion: current.conversion, output: current.output, excerpt: current.excerpt ?? "" };

    try {
      const output = this.#convert(selected, source);
      const excerptSource = selected.separator === "" ? undefined : source.split(selected.separator, 1)[0];
      const excerpt = source.includes(selected.separator) && excerptSource !== undefined ? this.#convert(selected, excerptSource) : undefined;
      const conversion = current?.conversion ?? `conversion:${subject}:${part}`;
      const record = { conversion, subject, part, dialect, digest: sourceDigest, output, ...(excerpt === undefined ? {} : { excerpt }) };
      if (current !== undefined) this.#conversionsByID.delete(current.conversion);
      this.#conversionsByKey.set(key, record);
      this.#conversionsByID.set(conversion, record);
      return { conversion, output, excerpt: excerpt ?? "" };
    } catch {
      throw new ConversionFailed();
    }
  }

  release({ subject }: { subject: string }) {
    let count = 0;
    for (const [key, conversion] of this.#conversionsByKey) {
      if (conversion.subject !== subject) continue;
      this.#conversionsByKey.delete(key);
      this.#conversionsByID.delete(conversion.conversion);
      count += 1;
    }
    return { subject, count };
  }

  _conversion({ conversion }: { conversion: string }) {
    const record = this.#conversionsByID.get(conversion);
    return record === undefined
      ? { subject: "", part: "", output: "", excerpt: "" }
      : { subject: record.subject, part: record.part, output: record.output, excerpt: record.excerpt ?? "" };
  }

  _for({ subject, part }: { subject: string; part: string }): { conversion: string; output: string; excerpt: string }[] {
    const record = this.#conversionsByKey.get(conversionKey(subject, part));
    return record === undefined ? [] : [{ conversion: record.conversion, output: record.output, excerpt: record.excerpt ?? "" }];
  }

  _dialect({ name }: { name: string }): { dialect: string }[] {
    const dialect = this.#dialectsByName.get(name);
    return dialect === undefined ? [] : [{ dialect: dialect.dialect }];
  }

  #convert(dialect: Dialect, source: string): string {
    if (dialect.name === "verbatim") return source;
    return marked(source, {
      async: false,
      gfm: dialect.extensions.some((extension) => ["tables", "strikethrough", "autolinks"].includes(extension)),
      breaks: false,
    });
  }
}
