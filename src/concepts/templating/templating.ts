import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";
import {
  CycleTag,
  Drop,
  IncludeTag,
  LayoutTag,
  Liquid,
  RenderTag,
  toValueSync,
  type Template as LiquidTemplate,
  type Variable,
} from "liquidjs";

const INVALID_TRUSTED_PATH = "A trusted path must contain one or more literal string segments.";
const INVALID_TRUSTED_VALUE = "A trusted path must name a string in the supplied context.";
const RECURSIVE_TEMPLATE = "The template dependency tree is recursive.";
const TEMPLATE_FAILED = "This Liquid template could not be evaluated.";
const TEMPLATE_NOT_FOUND = "There is no such template.";
const TEMPLATE_SYNTAX = "This Liquid template cannot be parsed.";
const UNDEFINED_VARIABLE = "This Liquid template reads a context value that is not defined.";
const UNSUPPORTED_TEMPLATE = "This Liquid feature is unsupported because its dependencies or escaping cannot be determined.";
const USED_TEMPLATE_NOT_FOUND = "A rendered template is not defined.";
const INVALID_TEMPLATE_ORIGIN = "A template origin must be well-formed text.";
const TEMPLATE_NAME_TAKEN = "Another source already owns this template name.";

export type TrustedWildcardPath = { readonly wildcard: readonly string[] };
export type TrustedPath = readonly string[] | TrustedWildcardPath;

export type TemplateErrorLocation = {
  templateName?: string;
  line?: number;
  column?: number;
};

class LocatedTemplateError extends Error {
  readonly templateName: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly detail: string | undefined;

  constructor(name: string, message: string, location: TemplateErrorLocation = {}, detail?: string) {
    super(detail === undefined ? message : `${message} ${detail}`);
    this.name = name;
    this.templateName = location.templateName;
    this.line = location.line;
    this.column = location.column;
    this.detail = detail;
  }
}

export class TemplateSyntax extends LocatedTemplateError {
  constructor(location: TemplateErrorLocation = {}, detail?: string) {
    super("TemplateSyntax", TEMPLATE_SYNTAX, location, detail);
  }
}

export class UnsupportedTemplate extends LocatedTemplateError {
  constructor(readonly feature: string, location: TemplateErrorLocation = {}) {
    super("UnsupportedTemplate", UNSUPPORTED_TEMPLATE, location, feature);
  }
}

export class InvalidTrustedPath extends Error {
  constructor(readonly index: number) {
    super(INVALID_TRUSTED_PATH);
    this.name = "InvalidTrustedPath";
  }
}

export class InvalidTrustedValue extends Error {
  readonly path: readonly string[];

  constructor(path: readonly string[]) {
    super(INVALID_TRUSTED_VALUE);
    this.name = "InvalidTrustedValue";
    this.path = [...path];
  }
}

export class InvalidTemplateOrigin extends Error {
  constructor() {
    super(INVALID_TEMPLATE_ORIGIN);
    this.name = "InvalidTemplateOrigin";
  }
}

export class TemplateNameTaken extends Error {
  constructor() {
    super(TEMPLATE_NAME_TAKEN);
    this.name = "TemplateNameTaken";
  }
}

export class TemplateNotFound extends Error {
  constructor() {
    super(TEMPLATE_NOT_FOUND);
    this.name = "TemplateNotFound";
  }
}

export class UsedTemplateNotFound extends LocatedTemplateError {
  constructor(
    readonly used: string,
    readonly referencedBy: string | undefined,
    location: TemplateErrorLocation,
  ) {
    super("UsedTemplateNotFound", USED_TEMPLATE_NOT_FOUND, location, `Missing: ${JSON.stringify(used)}.`);
  }
}

export class RecursiveTemplate extends LocatedTemplateError {
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[], location: TemplateErrorLocation) {
    super("RecursiveTemplate", RECURSIVE_TEMPLATE, location, `Cycle: ${cycle.map((name) => JSON.stringify(name)).join(" -> ")}.`);
    this.cycle = [...cycle];
  }
}

export class UndefinedVariable extends LocatedTemplateError {
  constructor(readonly variable: string | undefined, location: TemplateErrorLocation, detail?: string) {
    super("UndefinedVariable", UNDEFINED_VARIABLE, location, detail);
  }
}

export class TemplateFailed extends LocatedTemplateError {
  constructor(location: TemplateErrorLocation = {}, detail?: string) {
    super("TemplateFailed", TEMPLATE_FAILED, location, detail);
  }
}

type FailureCode =
  | "INVALID_TRUSTED_PATH"
  | "INVALID_TRUSTED_VALUE"
  | "RECURSIVE_TEMPLATE"
  | "TEMPLATE_FAILED"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_SYNTAX"
  | "UNDEFINED_VARIABLE"
  | "UNSUPPORTED_TEMPLATE"
  | "USED_TEMPLATE_NOT_FOUND";
type FailureRecord = {
  code: FailureCode;
  templateName: string | undefined;
  line: number | undefined;
  column: number | undefined;
};
type Read = { path: string[] };
type SegmentArray = Array<string | number | SegmentArray>;
type Use = { used: string; location: TemplateErrorLocation };
type PreparedTrustedPath =
  | { kind: "exact"; path: string[] }
  | { kind: "wildcard"; path: string[] };
type Inspection = { templates: LiquidTemplate[]; uses: Use[]; directReads: Read[] };
type TemplateRecord = {
  template: string;
  name: string;
  source: string;
  digest: string;
  uses: Use[];
  directReads: Read[];
};
type FillingRecord = {
  filling: string;
  subject: string;
  digest: string;
  output: string;
  uses: Use[];
  tree: string[];
  reads: Read[];
};
type RenderingRecord = {
  rendering: string;
  template: string;
  subject: string;
  output: string;
  tree: string[];
  reads: Read[];
};

type TokenWithPosition = {
  file?: string;
  getPosition?: () => number[];
  props?: TokenWithPosition[];
};

type LiquidErrorLike = {
  name?: string;
  message?: string;
  token?: TokenWithPosition;
  originalError?: { variableName?: string };
};

type RenderDetails = {
  file: unknown;
  with?: unknown;
  forBinding?: unknown;
  hash?: { hash: Record<string, unknown> };
  tokenizer?: { p: number; N: number };
};

function failureFromError(error: unknown): FailureRecord | undefined {
  const code =
    error instanceof InvalidTrustedPath
      ? "INVALID_TRUSTED_PATH"
      : error instanceof InvalidTrustedValue
        ? "INVALID_TRUSTED_VALUE"
        : error instanceof RecursiveTemplate
          ? "RECURSIVE_TEMPLATE"
          : error instanceof TemplateFailed
            ? "TEMPLATE_FAILED"
            : error instanceof TemplateNotFound
              ? "TEMPLATE_NOT_FOUND"
              : error instanceof TemplateSyntax
                ? "TEMPLATE_SYNTAX"
                : error instanceof UndefinedVariable
                  ? "UNDEFINED_VARIABLE"
                  : error instanceof UnsupportedTemplate
                    ? "UNSUPPORTED_TEMPLATE"
                    : error instanceof UsedTemplateNotFound
                      ? "USED_TEMPLATE_NOT_FOUND"
                      : undefined;
  if (code === undefined) return undefined;
  if (error instanceof LocatedTemplateError) {
    return {
      code,
      templateName: error.templateName,
      line: error.line,
      column: error.column,
    };
  }
  return { code, templateName: undefined, line: undefined, column: undefined };
}

const htmlEscape = new Liquid({ outputEscape: "escape" }).options.outputEscape!;

class TrustedHTML extends Drop {
  constructor(readonly html: string) {
    super();
  }

  valueOf(): string {
    return this.html;
  }
}

function escapeOutput(this: unknown, value: unknown): string {
  if (value instanceof TrustedHTML) return value.html;
  return htmlEscape.call(this, value);
}

function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function identity(kind: string, ...parts: string[]): string {
  return `${kind}:${parts.map((part) => `${part.length}:${part}`).join("")}`;
}

function pairKey(left: string, right: string): string {
  return JSON.stringify([left, right]);
}

function comparePaths(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = left[index]! < right[index]! ? -1 : left[index]! > right[index]! ? 1 : 0;
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function uniqueReads(paths: readonly (readonly string[])[]): Read[] {
  const unique = new Map<string, string[]>();
  for (const path of paths) unique.set(JSON.stringify(path), [...path]);
  return [...unique.values()].sort(comparePaths).map((path) => ({ path }));
}

function copyPath(path: readonly string[]): string[] | undefined {
  try {
    if (!Array.isArray(path) || Object.getPrototypeOf(path) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(path, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || lengthDescriptor.value === 0) return undefined;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(path);
    if (keys.length !== length + 1) return undefined;

    const copy = new Array<string>(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string") return undefined;
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(path, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
        return undefined;
      }
      copy[index] = descriptor.value;
    }
    return copy;
  } catch {
    return undefined;
  }
}

function copyTrustedWildcardPath(value: unknown): string[] | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "wildcard") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, "wildcard");
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return undefined;
    }
    if (descriptor.value !== null && typeof descriptor.value === "object" && isProxy(descriptor.value)) return undefined;
    return copyPath(descriptor.value as readonly string[]);
  } catch {
    return undefined;
  }
}

function copyTrustedPaths(paths: readonly TrustedPath[]): PreparedTrustedPath[] {
  try {
    if (!Array.isArray(paths) || Object.getPrototypeOf(paths) !== Array.prototype) throw new InvalidTrustedPath(0);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(paths, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) throw new InvalidTrustedPath(0);
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(paths);
    if (keys.length !== length + 1) throw new InvalidTrustedPath(0);

    const copy = new Array<PreparedTrustedPath>(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(paths, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new InvalidTrustedPath(index);
      const wildcard = copyTrustedWildcardPath(descriptor.value);
      if (wildcard !== undefined) {
        if (!wildcard.includes("*")) throw new InvalidTrustedPath(index);
        copy[index] = { kind: "wildcard", path: wildcard };
        continue;
      }
      const path = copyPath(descriptor.value as readonly string[]);
      if (path === undefined) throw new InvalidTrustedPath(index);
      copy[index] = { kind: "exact", path };
    }
    return copy;
  } catch (error) {
    if (error instanceof InvalidTrustedPath) throw error;
    throw new InvalidTrustedPath(0);
  }
}

function ownValue(container: unknown, segment: string): unknown {
  try {
    if (container === null || typeof container !== "object") throw new InvalidTrustedValue([segment]);
    const descriptor = Object.getOwnPropertyDescriptor(container, segment);
    if (descriptor === undefined || !("value" in descriptor)) throw new InvalidTrustedValue([segment]);
    return descriptor.value;
  } catch (error) {
    if (error instanceof InvalidTrustedValue) throw error;
    throw new InvalidTrustedValue([segment]);
  }
}

function replaceOwnValue(container: object, segment: string, value: unknown): object {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(container, segment);
    if (descriptor === undefined || !("value" in descriptor)) throw new InvalidTrustedValue([segment]);
    if (Array.isArray(container)) {
      const copy = Array.from(container);
      Object.defineProperty(copy, segment, { ...descriptor, value });
      return copy;
    }
    const descriptors = Object.getOwnPropertyDescriptors(container);
    descriptors[segment] = { ...descriptor, value };
    return Object.create(Object.getPrototypeOf(container), descriptors) as object;
  } catch (error) {
    if (error instanceof InvalidTrustedValue) throw error;
    throw new InvalidTrustedValue([segment]);
  }
}

function trustOne(context: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  const containers: object[] = [];
  let current: unknown = context;
  for (const segment of path) {
    if (current === null || typeof current !== "object") throw new InvalidTrustedValue(path);
    containers.push(current);
    try {
      current = ownValue(current, segment);
    } catch {
      throw new InvalidTrustedValue(path);
    }
  }
  if (current instanceof TrustedHTML) return context;
  if (typeof current !== "string") throw new InvalidTrustedValue(path);

  let replacement: unknown = new TrustedHTML(current);
  try {
    for (let index = path.length - 1; index >= 0; index -= 1) {
      replacement = replaceOwnValue(containers[index]!, path[index]!, replacement);
    }
  } catch {
    throw new InvalidTrustedValue(path);
  }
  return replacement as Record<string, unknown>;
}

function isPlainRecord(value: unknown): value is object {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownRecordEntries(value: unknown): Array<[string, unknown]> | undefined {
  if (!isPlainRecord(value)) return undefined;
  try {
    const entries: Array<[string, unknown]> = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      entries.push([key, descriptor.value]);
    }
    return entries;
  } catch {
    return undefined;
  }
}

function denseArrayItems(value: unknown): unknown[] | undefined {
  try {
    if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
      return undefined;
    }
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1) return undefined;

    const items = new Array<unknown>(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string") return undefined;
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      items[index] = descriptor.value;
    }
    return items;
  } catch {
    return undefined;
  }
}

function wildcardPaths(context: Record<string, unknown>, pattern: readonly string[]): string[][] {
  const paths: string[][] = [];

  const visit = (value: unknown, index: number, path: string[]): void => {
    if (index === pattern.length) {
      if (value === undefined || value === null) return;
      if (typeof value !== "string") throw new InvalidTrustedValue(path);
      paths.push(path);
      return;
    }

    const segment = pattern[index]!;
    if (segment === "*") {
      const items = denseArrayItems(value);
      if (items !== undefined) {
        items.forEach((item, itemIndex) => visit(item, index + 1, [...path, String(itemIndex)]));
        return;
      }
      const entries = ownRecordEntries(value);
      if (entries === undefined) throw new InvalidTrustedValue(path);
      for (const [key, item] of entries) visit(item, index + 1, [...path, key]);
      return;
    }

    if (!isPlainRecord(value)) throw new InvalidTrustedValue(path);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, segment);
    } catch {
      throw new InvalidTrustedValue([...path, segment]);
    }
    if (descriptor === undefined) return;
    if (!("value" in descriptor)) throw new InvalidTrustedValue([...path, segment]);
    visit(descriptor.value, index + 1, [...path, segment]);
  };

  visit(context, 0, []);
  return paths;
}

function trustedContext(
  context: Record<string, unknown>,
  trusted: readonly TrustedPath[],
): Record<string, unknown> {
  const paths = copyTrustedPaths(trusted);
  let prepared = context;
  for (const path of paths) {
    if (path.kind === "exact") {
      prepared = trustOne(prepared, path.path);
      continue;
    }
    for (const match of wildcardPaths(prepared, path.path)) prepared = trustOne(prepared, match);
  }
  return prepared;
}

function locationFromToken(token: TokenWithPosition | undefined, fallbackName?: string): TemplateErrorLocation {
  const [line, column] = token?.getPosition?.() ?? [];
  const templateName = tokenName(token) ?? fallbackName;
  return {
    ...(templateName === undefined ? {} : { templateName }),
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  };
}

function tokenName(token: TokenWithPosition | undefined): string | undefined {
  if (token?.file !== undefined) return token.file;
  for (const property of token?.props ?? []) {
    const name = tokenName(property);
    if (name !== undefined) return name;
  }
  return undefined;
}

function locationFromError(error: unknown, fallbackName?: string): TemplateErrorLocation {
  const candidate = error !== null && typeof error === "object" ? (error as LiquidErrorLike) : undefined;
  return locationFromToken(candidate?.token, fallbackName);
}

function detailFromError(error: unknown): string | undefined {
  if (error instanceof Error && error.message !== "") return error.message;
  return typeof error === "string" && error !== "" ? error : undefined;
}

function variableLocation(variable: Variable, fallbackName?: string): TemplateErrorLocation {
  const templateName = variable.location.file ?? fallbackName;
  return {
    ...(templateName === undefined ? {} : { templateName }),
    line: variable.location.row,
    column: variable.location.col,
  };
}

function literalPath(segments: SegmentArray): string[] | undefined {
  const path: string[] = [];
  for (const segment of segments) {
    if (Array.isArray(segment)) return undefined;
    path.push(String(segment));
  }
  return path.length === 0 ? undefined : path;
}

/** Fill dependency-sound Liquid templates into HTML-escaped text. */
export class TemplatingConcept {
  readonly #templatesByName = new Map<string, TemplateRecord>();
  readonly #templatesByID = new Map<string, TemplateRecord>();
  readonly #fillingsBySubject = new Map<string, FillingRecord>();
  readonly #fillingsByID = new Map<string, FillingRecord>();
  readonly #renderingsByKey = new Map<string, RenderingRecord>();
  readonly #renderingsByID = new Map<string, RenderingRecord>();
  readonly #failuresBySubject = new Map<string, FailureRecord>();
  readonly #originsByName = new Map<string, string>();

  define({ name, source }: { name: string; source: string }) {
    if (this.#originsByName.has(name) && this.#templatesByName.get(name)?.source !== source) throw new TemplateNameTaken();
    return this.#define(name, source);
  }

  register({ name, source, origin }: { name: string; source: string; origin: unknown }) {
    if (typeof origin !== "string" || !origin.isWellFormed()) throw new InvalidTemplateOrigin();
    const current = this.#originsByName.get(name);
    if (current !== undefined && current !== origin) throw new TemplateNameTaken();
    const result = this.#define(name, source);
    this.#originsByName.set(name, origin);
    return result;
  }

  #define(name: string, source: string) {
    const inspected = this.#inspect(source, name);
    const current = this.#templatesByName.get(name);
    if (current?.source === source) return { template: current.template, changed: false };

    const template = current?.template ?? identity("template", name);
    const record: TemplateRecord = {
      template,
      name,
      source,
      digest: digest(source),
      uses: inspected.uses,
      directReads: inspected.directReads,
    };
    this.#templatesByName.set(name, record);
    this.#templatesByID.set(template, record);
    return { template, changed: true };
  }

  forget({ name }: { name: string }) {
    const record = this.#templatesByName.get(name);
    if (record === undefined) throw new TemplateNotFound();
    this.#templatesByName.delete(name);
    this.#originsByName.delete(name);
    this.#templatesByID.delete(record.template);
    for (const [key, rendering] of this.#renderingsByKey) {
      if (rendering.template !== record.template) continue;
      this.#renderingsByKey.delete(key);
      this.#renderingsByID.delete(rendering.rendering);
    }
    return { template: record.template };
  }

  renderSource({
    subject,
    source,
    context,
    trusted,
    sourceName,
    sourceLine = 1,
  }: {
    subject: string;
    source: string;
    context: Record<string, unknown>;
    trusted: readonly TrustedPath[];
    sourceName?: string;
    sourceLine?: number;
  }) {
    try {
      const inspected = this.#inspect(source, sourceName);
      const prepared = trustedContext(context, trusted);
      this.#assertGraph(inspected.uses, sourceName);
      const tree = this.#tree(inspected.uses);
      const reads = this.#effectiveReads(source, sourceName);
      const output = this.#evaluate(source, prepared, sourceName);
      const filling = this.#fillingsBySubject.get(subject)?.filling ?? identity("filling", subject);
      const record: FillingRecord = {
        filling,
        subject,
        digest: digest(source),
        output,
        uses: inspected.uses,
        tree,
        reads,
      };
      this.#fillingsBySubject.set(subject, record);
      this.#fillingsByID.set(filling, record);
      this.#failuresBySubject.delete(subject);
      return { filling, output };
    } catch (error) {
      this.#recordFailure(subject, error, sourceName, sourceLine - 1);
      throw error;
    }
  }

  renderTemplate({
    template,
    subject,
    context,
    trusted,
  }: {
    template: string;
    subject: string;
    context: Record<string, unknown>;
    trusted: readonly TrustedPath[];
  }) {
    try {
      const record = this.#templatesByID.get(template);
      if (record === undefined) throw new TemplateNotFound();
      const prepared = trustedContext(context, trusted);
      this.#assertGraph(record.uses, record.name);
      const tree = this.#tree(record.uses);
      const reads = this.#effectiveReads(record.source, record.name);
      const output = this.#evaluate(record.source, prepared, record.name);
      const key = pairKey(template, subject);
      const rendering = this.#renderingsByKey.get(key)?.rendering ?? identity("rendering", template, subject);
      const rendered: RenderingRecord = { rendering, template, subject, output, tree, reads };
      this.#renderingsByKey.set(key, rendered);
      this.#renderingsByID.set(rendering, rendered);
      this.#failuresBySubject.delete(subject);
      return { rendering, output };
    } catch (error) {
      this.#recordFailure(subject, error);
      throw error;
    }
  }

  _template({ name }: { name: string }): { template: string; digest: string }[] {
    const record = this.#templatesByName.get(name);
    return record === undefined ? [] : [{ template: record.template, digest: record.digest }];
  }

  _uses({ owner }: { owner: string }): { used: string }[] {
    const record = this.#sourceOwner(owner);
    return record?.uses.map(({ used }) => ({ used })) ?? [];
  }

  _tree({ owner }: { owner: string }): { used: string }[] {
    const rendering = this.#renderingsByID.get(owner);
    if (rendering !== undefined) return rendering.tree.map((used) => ({ used }));
    const filling = this.#fillingsByID.get(owner);
    if (filling !== undefined) return filling.tree.map((used) => ({ used }));
    const template = this.#templatesByID.get(owner);
    return template === undefined ? [] : this.#tree(template.uses).map((used) => ({ used }));
  }

  _usedBy({ name }: { name: string }): { owner: string }[] {
    return [...this.#templatesByID.values(), ...this.#fillingsByID.values()]
      .filter((record) => record.uses.some((use) => use.used === name))
      .map((record) => ({ owner: "template" in record ? record.template : record.filling }))
      .sort((left, right) => (left.owner < right.owner ? -1 : left.owner > right.owner ? 1 : 0));
  }

  _reads({ owner }: { owner: string }): Read[] {
    const rendering = this.#renderingsByID.get(owner);
    if (rendering !== undefined) return rendering.reads.map(({ path }) => ({ path: [...path] }));
    const filling = this.#fillingsByID.get(owner);
    if (filling !== undefined) return filling.reads.map(({ path }) => ({ path: [...path] }));
    const template = this.#templatesByID.get(owner);
    return template === undefined ? [] : this.#effectiveReads(template.source, template.name);
  }

  _failure({ subject }: { subject: string }): FailureRecord[] {
    const failure = this.#failuresBySubject.get(subject);
    return failure === undefined
      ? []
      : [
          {
            code: failure.code,
            templateName: failure.templateName,
            line: failure.line,
            column: failure.column,
          },
        ];
  }

  /** Resolve a failure to its named template, or to the caller's authored source. */
  _failureLocation({ subject, fallbackSource }: { subject: string; fallbackSource: string }): {
    source: string;
    line: number | undefined;
    column: number | undefined;
  }[] {
    const failure = this.#failuresBySubject.get(subject);
    return failure === undefined
      ? []
      : [{ source: failure.templateName ?? fallbackSource, line: failure.line, column: failure.column }];
  }

  _filling({ subject }: { subject: string }): { filling: string; output: string }[] {
    const record = this.#fillingsBySubject.get(subject);
    return record === undefined ? [] : [{ filling: record.filling, output: record.output }];
  }

  _rendering({ template, subject }: { template: string; subject: string }): { rendering: string; output: string }[] {
    const record = this.#renderingsByKey.get(pairKey(template, subject));
    return record === undefined ? [] : [{ rendering: record.rendering, output: record.output }];
  }

  _of({ rendering }: { rendering: string }): { template: string; subject: string; output: string }[] {
    const record = this.#renderingsByID.get(rendering);
    return record === undefined ? [] : [{ template: record.template, subject: record.subject, output: record.output }];
  }

  #inspect(source: string, sourceName?: string): Inspection {
    const engine = this.#engine(Object.create(null) as Record<string, string>);
    let templates: LiquidTemplate[];
    try {
      templates = engine.parse(source, sourceName);
    } catch (error) {
      throw new TemplateSyntax(locationFromError(error, sourceName), detailFromError(error));
    }

    const uses: Use[] = [];
    this.#visit(templates, (template) => {
      const location = locationFromToken(template.token, sourceName);
      if (template instanceof IncludeTag) throw new UnsupportedTemplate("The include tag is not supported; use a literal render tag.", location);
      if (template instanceof LayoutTag) throw new UnsupportedTemplate("The Liquid layout tag is not supported; render a selected template instead.", location);
      if (template instanceof CycleTag) throw new UnsupportedTemplate("The cycle tag can bypass HTML output escaping.", location);
      if (!(template instanceof RenderTag)) return;

      const details = template as unknown as RenderDetails;
      if (typeof details.file !== "string") {
        throw new UnsupportedTemplate("A render name must be one quoted literal without interpolation.", location);
      }
      if (details.with !== undefined || details.forBinding !== undefined) {
        throw new UnsupportedTemplate("Render with/for forms are not supported; use named arguments.", location);
      }
      if (details.file === "" || details.file.startsWith("./") || details.file.startsWith("../") || details.file.startsWith("/")) {
        throw new UnsupportedTemplate("A render name must be nonempty and must not be a relative or absolute path.", location);
      }
      if (details.tokenizer !== undefined && details.tokenizer.p !== details.tokenizer.N) {
        throw new UnsupportedTemplate("A render tag may contain only named key: value arguments.", location);
      }
      const hash = details.hash?.hash ?? {};
      if (Object.getPrototypeOf(hash) !== Object.prototype) {
        throw new UnsupportedTemplate("A render tag may contain only safe named key: value arguments.", location);
      }
      for (const [name, value] of Object.entries(hash)) {
        if (name === "__proto__" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) || value === undefined) {
          throw new UnsupportedTemplate("A render tag may contain only named key: value arguments.", location);
        }
      }
      uses.push({ used: details.file, location });
    });

    let analysis: ReturnType<Liquid["analyzeSync"]>;
    try {
      analysis = engine.analyzeSync(templates, { partials: false });
    } catch (error) {
      throw new TemplateSyntax(locationFromError(error, sourceName), detailFromError(error));
    }

    for (const variables of Object.values(analysis.variables)) {
      for (const variable of variables) {
        if (literalPath(variable.toArray()) !== undefined) continue;
        throw new UnsupportedTemplate("Dynamic context member access is not supported.", variableLocation(variable, sourceName));
      }
    }

    const paths: string[][] = [];
    for (const variables of Object.values(analysis.globals)) {
      for (const variable of variables) {
        const path = literalPath(variable.toArray());
        if (path !== undefined) paths.push(path);
      }
    }
    return { templates, uses: this.#uniqueUses(uses), directReads: uniqueReads(paths) };
  }

  #evaluate(
    source: string,
    context: Record<string, unknown>,
    sourceName?: string,
  ): string {
    try {
      const engine = this.#engine(this.#templateSources());
      return engine.renderSync(engine.parse(source, sourceName), {}, { globals: context }) as string;
    } catch (error) {
      const liquidError = error !== null && typeof error === "object" ? (error as LiquidErrorLike) : undefined;
      const location = locationFromError(error, sourceName);
      const detail = detailFromError(error);
      if (
        liquidError?.name === "UndefinedVariableError" &&
        typeof liquidError.originalError?.variableName === "string"
      ) {
        throw new UndefinedVariable(liquidError.originalError?.variableName, location, detail);
      }
      throw new TemplateFailed(location, detail);
    }
  }

  #engine(templates: Record<string, string>): Liquid {
    const engine = new Liquid({
      dynamicPartials: true,
      lenientIf: true,
      outputEscape: escapeOutput,
      ownPropertyOnly: true,
      strictFilters: true,
      strictVariables: true,
      templates,
    });
    // LiquidJS marks its built-in raw filter as an escaping bypass. Here it is
    // deliberately an ordinary identity filter; only trusted context values bypass.
    engine.registerFilter("raw", (value: unknown) => (value instanceof TrustedHTML ? value.html : value));
    return engine;
  }

  #effectiveReads(source: string, sourceName?: string): Read[] {
    try {
      const engine = this.#engine(this.#templateSources(true));
      const segments = engine.globalVariableSegmentsSync(engine.parse(source, sourceName), { partials: true });
      const paths = segments.map((path) => literalPath(path));
      if (paths.some((path) => path === undefined)) {
        throw new UnsupportedTemplate("Dynamic context member access is not supported.", { templateName: sourceName });
      }
      return uniqueReads(paths as string[][]);
    } catch (error) {
      if (error instanceof UnsupportedTemplate) throw error;
      throw new TemplateFailed(locationFromError(error, sourceName), detailFromError(error));
    }
  }

  #templateSources(withMissingPlaceholders = false): Record<string, string> {
    const sources = Object.create(null) as Record<string, string>;
    for (const record of this.#templatesByName.values()) {
      Object.defineProperty(sources, record.name, { value: record.source, enumerable: true, configurable: true, writable: true });
    }
    if (withMissingPlaceholders) {
      for (const record of this.#templatesByName.values()) {
        for (const { used } of record.uses) {
          if (Object.hasOwn(sources, used)) continue;
          Object.defineProperty(sources, used, { value: "", enumerable: true, configurable: true, writable: true });
        }
      }
    }
    return sources;
  }

  #visit(templates: LiquidTemplate[], visit: (template: LiquidTemplate) => void): void {
    for (const template of templates) {
      visit(template);
      if (template.children !== undefined) this.#visit(toValueSync(template.children(false, true)), visit);
    }
  }

  #uniqueUses(uses: readonly Use[]): Use[] {
    const unique = new Map<string, Use>();
    for (const use of uses) if (!unique.has(use.used)) unique.set(use.used, use);
    return [...unique.values()];
  }

  #assertGraph(uses: readonly Use[], rootName?: string): void {
    const checked = new Set<string>();
    const assertDefined = (use: Use, referencedBy?: string): void => {
      const template = this.#templatesByName.get(use.used);
      if (template === undefined) throw new UsedTemplateNotFound(use.used, referencedBy, use.location);
      if (checked.has(use.used)) return;
      checked.add(use.used);
      for (const nested of template.uses) assertDefined(nested, template.name);
    };
    for (const use of uses) assertDefined(use, rootName);

    const visited = new Set<string>();
    const active = new Map<string, number>();
    const stack: string[] = [];
    const visit = (use: Use): void => {
      const activeIndex = active.get(use.used);
      if (activeIndex !== undefined) {
        throw new RecursiveTemplate([...stack.slice(activeIndex), use.used], use.location);
      }
      if (visited.has(use.used)) return;
      active.set(use.used, stack.length);
      stack.push(use.used);
      for (const nested of this.#templatesByName.get(use.used)!.uses) visit(nested);
      stack.pop();
      active.delete(use.used);
      visited.add(use.used);
    };
    for (const use of uses) visit(use);
  }

  #tree(uses: readonly Use[]): string[] {
    const tree: string[] = [];
    const visited = new Set<string>();
    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      tree.push(name);
      for (const nested of this.#templatesByName.get(name)?.uses ?? []) visit(nested.used);
    };
    for (const use of uses) visit(use.used);
    return tree;
  }

  #sourceOwner(owner: string): TemplateRecord | FillingRecord | undefined {
    return this.#templatesByID.get(owner) ?? this.#fillingsByID.get(owner);
  }

  #recordFailure(subject: string, error: unknown, sourceName?: string, lineOffset = 0): void {
    const failure = failureFromError(error);
    if (failure === undefined) return;
    if (
      failure.templateName === sourceName &&
      failure.line !== undefined &&
      Number.isSafeInteger(lineOffset) &&
      lineOffset > 0
    ) {
      failure.line += lineOffset;
    }
    this.#failuresBySubject.set(subject, failure);
  }
}
