import picomatch from "picomatch";

export class MalformedPattern extends Error {}

const matchOptions = {
  basename: false,
  contains: false,
  debug: true,
  dot: true,
  fastpaths: false,
  keepQuotes: false,
  nobrace: false,
  nobracket: false,
  nocase: false,
  noextglob: false,
  noglobstar: false,
  nonegate: true,
  posix: true,
  strictBrackets: true,
  strictSlashes: true,
  windows: false,
} as const;

/** Compile portable path patterns once and answer their matches deterministically. */
export class MatchingConcept {
  readonly #patterns = new Map<string, (path: string) => boolean>();

  compile({ text }: { text: string }) {
    if (this.#patterns.has(text)) return { pattern: text };

    let matcher: (path: string) => boolean;
    try {
      const compiled = picomatch(text, matchOptions, true);
      if (compiled.state.quotes !== 0) throw new SyntaxError("Unterminated quoted run");
      matcher = compiled;
    } catch {
      throw new MalformedPattern();
    }

    this.#patterns.set(text, matcher);
    return { pattern: text };
  }

  _matches({ pattern, path }: { pattern: string; path: string }) {
    return { matched: this.#patterns.get(pattern)?.(path) ?? false };
  }

  _compiled({ text }: { text: string }): { pattern: string }[] {
    return this.#patterns.has(text) ? [{ pattern: text }] : [];
  }
}
