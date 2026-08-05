import picomatch from "picomatch";

export class MalformedPattern extends Error {}

const globOptions = {
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

function compileGlob(pattern: string): void {
  const matcher = picomatch(pattern, globOptions, true);
  if (matcher.state.quotes !== 0) throw new SyntaxError("Unterminated quoted run");
}

/** Admit reusable path selectors under one stable glob contract. */
export class MatchingConcept {
  readonly #patterns = new Set<string>();

  compile({ text }: { text: string }) {
    if (this.#patterns.has(text)) return { pattern: text };

    try {
      compileGlob(text);
    } catch {
      throw new MalformedPattern();
    }

    this.#patterns.add(text);
    return { pattern: text };
  }

  _compiled({ text }: { text: string }): { pattern: string }[] {
    return this.#patterns.has(text) ? [{ pattern: text }] : [];
  }
}
