import picomatch from "picomatch";

export class MalformedPattern extends Error {}

function hasBalancedGroups(text: string): boolean {
  const closes: Record<string, string> = { "[": "]", "{": "}", "(": ")" };
  const stack: string[] = [];
  let escaped = false;
  for (const character of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character in closes) {
      stack.push(closes[character]!);
      continue;
    }
    if (stack.at(-1) === character) stack.pop();
    else if (["]", "}", ")"].includes(character)) return false;
  }
  return !escaped && stack.length === 0;
}

/** Compile named glob patterns once and answer their matches deterministically. */
export class MatchingConcept {
  readonly #patterns = new Map<string, (path: string) => boolean>();

  compile({ text }: { text: string }) {
    if (!hasBalancedGroups(text)) throw new MalformedPattern();
    try {
      const matcher = picomatch(text, { dot: true, nonegate: true });
      this.#patterns.set(text, matcher);
      return { pattern: text };
    } catch {
      throw new MalformedPattern();
    }
  }

  _matches({ pattern, path }: { pattern: string; path: string }) {
    return { matched: this.#patterns.get(pattern)?.(path) ?? false };
  }

  _compiled({ text }: { text: string }): { pattern: string }[] {
    return this.#patterns.has(text) ? [{ pattern: text }] : [];
  }
}
