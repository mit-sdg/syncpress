import { createHash } from "node:crypto";
import { Marked, type MarkedExtension, type Token } from "marked";

export class InvalidProfile extends Error {}
export class UnsupportedProfileKind extends Error {}
export class UnsupportedExtension extends Error {}
export class IncompatibleProfile extends Error {}
export class ProfileNotFound extends Error {}
export class InvalidConversionInput extends Error {}
export class InvalidSubject extends Error {}
export class ConversionFailed extends Error {}

const SUPPORTED_EXTENSIONS = ["tables", "footnotes", "strikethrough", "autolinks"] as const;
type MarkdownExtension = (typeof SUPPORTED_EXTENSIONS)[number];
type ProfileKind = "markdown" | "verbatim";
type Profile = {
  profile: string;
  settingsKey: string;
  name: string;
  kind: ProfileKind;
  extensions: MarkdownExtension[];
  raw: boolean;
  separator: string;
};
type Conversion = {
  conversion: string;
  subject: string;
  part: string;
  profile: string;
  source: string;
  digest: string;
  output: string;
  excerpt?: string;
};

type FootnoteDefinitionToken = {
  type: "footnoteDefinition";
  raw: string;
  label: string;
  tokens: Token[];
  output?: string;
};

type FootnoteReferenceToken = {
  type: "footnoteReference";
  raw: string;
  label: string;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identity(prefix: string, tuple: unknown[]): string {
  return `${prefix}:${digest(JSON.stringify(tuple))}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isOwnError(error: unknown): boolean {
  return (
    error instanceof InvalidProfile ||
    error instanceof UnsupportedProfileKind ||
    error instanceof UnsupportedExtension ||
    error instanceof IncompatibleProfile
  );
}

function normalizeProfile(input: {
  name: string;
  kind: string;
  extensions: string[];
  raw: boolean;
  separator: string;
}): Omit<Profile, "profile" | "settingsKey"> {
  try {
    if (typeof input.name !== "string" || input.name.length === 0) throw new InvalidProfile();
    if (
      typeof input.kind !== "string" ||
      !Array.isArray(input.extensions) ||
      typeof input.raw !== "boolean" ||
      typeof input.separator !== "string"
    ) {
      throw new InvalidProfile();
    }

    const requested = new Set<string>();
    for (const extension of input.extensions) {
      if (typeof extension !== "string") throw new InvalidProfile();
      if (requested.has(extension)) throw new InvalidProfile();
      requested.add(extension);
    }
    if (input.kind !== "markdown" && input.kind !== "verbatim") throw new UnsupportedProfileKind();
    if ([...requested].some((extension) => !(SUPPORTED_EXTENSIONS as readonly string[]).includes(extension))) {
      throw new UnsupportedExtension();
    }
    const extensions = SUPPORTED_EXTENSIONS.filter((extension) => requested.has(extension));
    if (input.kind === "verbatim" && (extensions.length !== 0 || !input.raw)) throw new IncompatibleProfile();
    return { name: input.name, kind: input.kind, extensions, raw: input.raw, separator: input.separator };
  } catch (error) {
    if (isOwnError(error)) throw error;
    throw new InvalidProfile();
  }
}

function footnotes(): MarkedExtension {
  const definitions = new Map<string, FootnoteDefinitionToken>();
  const references = new Map<string, string[]>();
  const order: string[] = [];

  return {
    extensions: [
      {
        name: "footnoteDefinition",
        level: "block",
        start(source) {
          const found = source.match(/^ {0,3}\[\^[A-Za-z0-9_-]+\]:/m);
          return found?.index;
        },
        tokenizer(source) {
          const first = /^(?: {0,3})\[\^([A-Za-z0-9_-]+)\]:[ \t]*(.*)(?:\n|$)/.exec(source);
          if (first === null) return undefined;

          let raw = first[0];
          const lines = [first[2] ?? ""];
          let rest = source.slice(raw.length);
          while (rest !== "") {
            const continuation = /^(?: {4}|\t)(.*)(?:\n|$)/.exec(rest);
            if (continuation !== null) {
              raw += continuation[0];
              lines.push(continuation[1] ?? "");
              rest = rest.slice(continuation[0].length);
              continue;
            }
            const blank = /^[ \t]*\n/.exec(rest);
            if (blank === null || !/^(?: {4}|\t)/.test(rest.slice(blank[0].length))) break;
            raw += blank[0];
            lines.push("");
            rest = rest.slice(blank[0].length);
          }

          const label = first[1]!.toLowerCase();
          const text = lines.join("\n");
          if (text.trim() === "" || definitions.has(label)) throw new Error("Malformed footnote definition.");
          const token: FootnoteDefinitionToken = {
            type: "footnoteDefinition",
            raw,
            label,
            tokens: this.lexer.blockTokens(text, []),
          };
          definitions.set(label, token);
          return token;
        },
        renderer(token) {
          const definition = token as FootnoteDefinitionToken;
          definition.output = this.parser.parse(definition.tokens);
          return "";
        },
        childTokens: ["tokens"],
      },
      {
        name: "footnoteReference",
        level: "inline",
        start(source) {
          return source.search(/\[\^[A-Za-z0-9_-]+\]/);
        },
        tokenizer(source) {
          const found = /^\[\^([A-Za-z0-9_-]+)\]/.exec(source);
          if (found === null) return undefined;
          const label = found[1]!.toLowerCase();
          if (!definitions.has(label)) return undefined;
          return { type: "footnoteReference", raw: found[0], label } satisfies FootnoteReferenceToken;
        },
        renderer(token) {
          const { label } = token as FootnoteReferenceToken;
          let ids = references.get(label);
          if (ids === undefined) {
            ids = [];
            references.set(label, ids);
            order.push(label);
          }
          const id = `fnref-${label}${ids.length === 0 ? "" : `-${ids.length + 1}`}`;
          ids.push(id);
          return `<sup><a href="#fn-${label}" id="${id}" data-footnote-ref aria-describedby="footnote-label">${order.indexOf(label) + 1}</a></sup>`;
        },
      },
    ],
    hooks: {
      postprocess(output) {
        if (order.length === 0) return output;
        const items = order.map((label, index) => {
          const definition = definitions.get(label)!;
          const backlinks = references
            .get(label)!
            .map(
              (reference, referenceIndex) =>
                `<a href="#${reference}" data-footnote-backref aria-label="Back to reference ${index + 1}${referenceIndex === 0 ? "" : `-${referenceIndex + 1}`}">&#8617;</a>`,
            )
            .join(" ");
          return `<li id="fn-${label}">\n${definition.output ?? ""}${backlinks}\n</li>`;
        });
        const separator = output === "" || output.endsWith("\n") ? "" : "\n";
        return `${output}${separator}<section class="footnotes" data-footnotes>\n<h2 class="sr-only" id="footnote-label">Footnotes</h2>\n<ol>\n${items.join("\n")}\n</ol>\n</section>\n`;
      },
    },
  };
}

function markdown(profile: Profile, source: string): string {
  const enabled = new Set(profile.extensions);
  const tokenizer: NonNullable<MarkedExtension["tokenizer"]> = {};
  if (!enabled.has("tables")) tokenizer.table = () => undefined;
  if (!enabled.has("strikethrough")) tokenizer.del = () => undefined;
  if (!enabled.has("autolinks")) tokenizer.url = () => undefined;
  if (!enabled.has("footnotes")) {
    tokenizer.def = (value) => (/^ {0,3}\[\^/.test(value) ? undefined : false);
  }

  const renderer: NonNullable<MarkedExtension["renderer"]> = {
    checkbox({ checked }) {
      return checked ? "[x] " : "[ ] ";
    },
  };
  if (!profile.raw) renderer.html = ({ text }) => escapeHtml(text);

  const parser = new Marked({
    async: false,
    breaks: false,
    gfm: true,
    pedantic: false,
    silent: false,
    tokenizer,
    renderer,
  });
  if (enabled.has("footnotes")) parser.use(footnotes());
  return parser.parse(source, { async: false });
}

/** Convert explicit Markdown and verbatim profiles with slot-local caching. */
export class ConvertingConcept {
  readonly #profilesByName = new Map<string, Profile>();
  readonly #profilesByID = new Map<string, Profile>();
  readonly #conversionsBySubject = new Map<string, Map<string, Conversion>>();
  readonly #conversionsByID = new Map<string, Conversion>();

  declare(input: { name: string; kind: string; extensions: string[]; raw: boolean; separator: string }) {
    const normalized = normalizeProfile(input);
    const settingsKey = JSON.stringify([
      normalized.name,
      normalized.kind,
      normalized.extensions,
      normalized.raw,
      normalized.separator,
    ]);
    const current = this.#profilesByName.get(normalized.name);
    if (current?.settingsKey === settingsKey) return { profile: current.profile, changed: false };

    if (current !== undefined) {
      this.#profilesByID.delete(current.profile);
      this.#removeConversions((conversion) => conversion.profile === current.profile);
    }
    const profile = identity("profile", [
      normalized.name,
      normalized.kind,
      normalized.extensions,
      normalized.raw,
      normalized.separator,
    ]);
    const record: Profile = { profile, settingsKey, ...normalized, extensions: [...normalized.extensions] };
    this.#profilesByName.set(record.name, record);
    this.#profilesByID.set(record.profile, record);
    return { profile, changed: true };
  }

  convert({ subject, part, profile, source }: { subject: string; part: string; profile: string; source: string }) {
    const selected = this.#profilesByID.get(profile);
    if (selected === undefined) throw new ProfileNotFound();
    if (typeof subject !== "string" || typeof part !== "string" || typeof source !== "string") {
      throw new InvalidConversionInput();
    }

    const current = this.#conversionsBySubject.get(subject)?.get(part);
    if (current?.profile === profile && current.source === source) {
      return { conversion: current.conversion, output: current.output };
    }

    let output: string;
    let excerpt: string | undefined;
    try {
      output = this.#convert(selected, source);
      if (selected.separator !== "") {
        const separatorAt = source.indexOf(selected.separator);
        if (separatorAt !== -1) excerpt = this.#convert(selected, source.slice(0, separatorAt));
      }
    } catch {
      throw new ConversionFailed();
    }

    const conversion = identity("conversion", [subject, part]);
    const record: Conversion = {
      conversion,
      subject,
      part,
      profile,
      source,
      digest: digest(source),
      output,
      ...(excerpt === undefined ? {} : { excerpt }),
    };
    let parts = this.#conversionsBySubject.get(subject);
    if (parts === undefined) {
      parts = new Map();
      this.#conversionsBySubject.set(subject, parts);
    }
    parts.set(part, record);
    this.#conversionsByID.set(conversion, record);
    return { conversion, output };
  }

  release({ subject }: { subject: string }) {
    if (typeof subject !== "string") throw new InvalidSubject();
    const count = this.#conversionsBySubject.get(subject)?.size ?? 0;
    this.#removeConversions((conversion) => conversion.subject === subject);
    return { subject, count };
  }

  _profile(
    { name }: { name: string },
  ): { profile: string; kind: string; extensions: string[]; raw: boolean; separator: string }[] {
    if (typeof name !== "string") return [];
    const profile = this.#profilesByName.get(name);
    return profile === undefined
      ? []
      : [
          {
            profile: profile.profile,
            kind: profile.kind,
            extensions: [...profile.extensions],
            raw: profile.raw,
            separator: profile.separator,
          },
        ];
  }

  _conversion(
    { conversion }: { conversion: string },
  ): { subject: string; part: string; profile: string; digest: string; output: string }[] {
    if (typeof conversion !== "string") return [];
    const record = this.#conversionsByID.get(conversion);
    return record === undefined
      ? []
      : [
          {
            subject: record.subject,
            part: record.part,
            profile: record.profile,
            digest: record.digest,
            output: record.output,
          },
        ];
  }

  _for(
    { subject, part }: { subject: string; part: string },
  ): { conversion: string; profile: string; digest: string; output: string }[] {
    if (typeof subject !== "string" || typeof part !== "string") return [];
    const record = this.#conversionsBySubject.get(subject)?.get(part);
    return record === undefined
      ? []
      : [{ conversion: record.conversion, profile: record.profile, digest: record.digest, output: record.output }];
  }

  _excerpt({ subject, part }: { subject: string; part: string }): { conversion: string; excerpt: string }[] {
    if (typeof subject !== "string" || typeof part !== "string") return [];
    const record = this.#conversionsBySubject.get(subject)?.get(part);
    return record?.excerpt === undefined ? [] : [{ conversion: record.conversion, excerpt: record.excerpt }];
  }

  #convert(profile: Profile, source: string): string {
    return profile.kind === "verbatim" ? source : markdown(profile, source);
  }

  #removeConversions(matches: (conversion: Conversion) => boolean): void {
    for (const [subject, parts] of this.#conversionsBySubject) {
      for (const [part, conversion] of parts) {
        if (!matches(conversion)) continue;
        parts.delete(part);
        this.#conversionsByID.delete(conversion.conversion);
      }
      if (parts.size === 0) this.#conversionsBySubject.delete(subject);
    }
  }
}
