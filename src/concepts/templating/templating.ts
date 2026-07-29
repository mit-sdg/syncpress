import { createHash } from "node:crypto";
import { Liquid, Output, RenderTag, toValueSync, type Template } from "liquidjs";

export class TemplateSyntax extends Error {}
export class TemplateNotFound extends Error {}
export class UsedTemplateNotFound extends Error {
  constructor(readonly used: string) {
    super(`The template uses undefined template "${used}".`);
  }
}
export class RecursiveTemplate extends Error {}
export class TemplateFailed extends Error {}

type Read = { root: string; member: string };
type TemplateRecord = { template: string; name: string; source: string; digest: string; uses: string[]; reads: Read[] };
type FillingRecord = { filling: string; subject: string; digest: string; output: string; uses: string[]; reads: Read[] };
type RenderingRecord = { rendering: string; template: string; subject: string; output: string };

const rawFilter = "syncpress_raw";

function digest(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function readFor(path: string): Read {
  const separator = path.indexOf(".");
  return separator === -1 ? { root: path, member: "" } : { root: path.slice(0, separator), member: path.slice(separator + 1) };
}

/** Render named Liquid templates and one-off source without owning their context or output. */
export class TemplatingConcept {
  readonly #templatesByName = new Map<string, TemplateRecord>();
  readonly #templatesByID = new Map<string, TemplateRecord>();
  readonly #fillingsBySubject = new Map<string, FillingRecord>();
  readonly #fillingsByID = new Map<string, FillingRecord>();
  readonly #renderingsByKey = new Map<string, RenderingRecord>();
  readonly #renderingsByID = new Map<string, RenderingRecord>();

  define({ name, source }: { name: string; source: string }) {
    const inspected = this.#inspect(source);
    const nextDigest = digest(source);
    const current = this.#templatesByName.get(name);
    if (current?.digest === nextDigest) return { template: current.template, changed: false };

    const template = current?.template ?? `template:${name}`;
    const record = { template, name, source, digest: nextDigest, ...inspected };
    this.#templatesByName.set(name, record);
    this.#templatesByID.set(template, record);
    return { template, changed: true };
  }

  forget({ name }: { name: string }) {
    const record = this.#templatesByName.get(name);
    if (record === undefined) throw new TemplateNotFound();
    this.#templatesByName.delete(name);
    this.#templatesByID.delete(record.template);
    for (const [key, rendering] of this.#renderingsByKey) {
      if (rendering.template !== record.template) continue;
      this.#renderingsByKey.delete(key);
      this.#renderingsByID.delete(rendering.rendering);
    }
    return { template: record.template };
  }

  fill({ subject, source, context, raw }: { subject: string; source: string; context: Record<string, unknown>; raw: string[] }) {
    const inspected = this.#inspect(source);
    this.#assertDefined(inspected.uses);
    const output = this.#evaluate(source, context, raw, inspected.templates);
    const filling = this.#fillingsBySubject.get(subject)?.filling ?? `filling:${subject}`;
    const record = { filling, subject, digest: digest(source), output, uses: inspected.uses, reads: inspected.reads };
    this.#fillingsBySubject.set(subject, record);
    this.#fillingsByID.set(filling, record);
    return { filling, output };
  }

  render({ template, subject, context, raw }: { template: string; subject: string; context: Record<string, unknown>; raw: string[] }) {
    const record = this.#templatesByID.get(template);
    if (record === undefined) throw new TemplateNotFound();
    this.#assertDefined(record.uses);
    if (this.#hasRecursion(record.uses)) throw new RecursiveTemplate();

    const output = this.#evaluate(record.source, context, raw);
    const key = `${template}\u0000${subject}`;
    const rendering = this.#renderingsByKey.get(key)?.rendering ?? `rendering:${template}:${subject}`;
    const rendered = { rendering, template, subject, output };
    this.#renderingsByKey.set(key, rendered);
    this.#renderingsByID.set(rendering, rendered);
    return { rendering, output };
  }

  _template({ name }: { name: string }): { template: string; digest: string }[] {
    const record = this.#templatesByName.get(name);
    return record === undefined ? [] : [{ template: record.template, digest: record.digest }];
  }

  _uses({ owner }: { owner: string }): { used: string }[] {
    return this.#owner(owner)?.uses.map((used) => ({ used })) ?? [];
  }

  _tree({ owner }: { owner: string }): { used: string }[] {
    const root = this.#owner(owner);
    if (root === undefined) return [];
    const used = new Set<string>();
    const visit = (name: string): void => {
      if (used.has(name)) return;
      used.add(name);
      for (const nested of this.#templatesByName.get(name)?.uses ?? []) visit(nested);
    };
    for (const name of root.uses) visit(name);
    return [...used].map((used) => ({ used }));
  }

  _usedBy({ name }: { name: string }): { owner: string }[] {
    return [...this.#templatesByID.values(), ...this.#fillingsByID.values()]
      .filter((record) => record.uses.includes(name))
      .map((record) => ({ owner: "template" in record ? record.template : record.filling }))
      .sort((left, right) => (left.owner < right.owner ? -1 : left.owner > right.owner ? 1 : 0));
  }

  _reads({ owner }: { owner: string }): Read[] {
    return this.#owner(owner)?.reads.map(({ root, member }) => ({ root, member })) ?? [];
  }

  _filling({ subject }: { subject: string }): { filling: string; output: string }[] {
    const record = this.#fillingsBySubject.get(subject);
    return record === undefined ? [] : [{ filling: record.filling, output: record.output }];
  }

  _rendering({ template, subject }: { template: string; subject: string }): { rendering: string; output: string }[] {
    const record = this.#renderingsByKey.get(`${template}\u0000${subject}`);
    return record === undefined ? [] : [{ rendering: record.rendering, output: record.output }];
  }

  _of({ rendering }: { rendering: string }): { template: string; subject: string; output: string } {
    const record = this.#renderingsByID.get(rendering);
    return record === undefined ? { template: "", subject: "", output: "" } : { template: record.template, subject: record.subject, output: record.output };
  }

  #inspect(source: string): { templates: Template[]; uses: string[]; reads: Read[] } {
    const engine = new Liquid();
    let templates: Template[];
    try {
      templates = engine.parse(source);
    } catch {
      throw new TemplateSyntax();
    }

    const uses: string[] = [];
    this.#visit(templates, (template) => {
      if (!(template instanceof RenderTag)) return;
      const file = (template as unknown as { file: unknown }).file;
      if (typeof file === "string") uses.push(file);
    });

    try {
      const paths = unique(engine.globalFullVariablesSync(templates, { partials: false }));
      return { templates, uses: unique(uses), reads: paths.map((path) => readFor(path)) };
    } catch {
      throw new TemplateSyntax();
    }
  }

  #evaluate(source: string, context: Record<string, unknown>, raw: string[], templates?: Template[]): string {
    try {
      const engine = this.#engine(raw);
      return engine.renderSync(engine.parse(this.#withRaw(source, raw, templates)), {}, { globals: context }) as string;
    } catch {
      throw new TemplateFailed();
    }
  }

  #engine(raw: string[]): Liquid {
    const parser = new Liquid();
    const templates: Record<string, string> = Object.create(null);
    for (const record of this.#templatesByName.values()) templates[record.name] = this.#withRaw(record.source, raw, parser.parse(record.source));

    const engine = new Liquid({ outputEscape: "escape", ownPropertyOnly: true, strictFilters: true, strictVariables: true, templates });
    engine.registerFilter(rawFilter, { raw: true, handler: (value: unknown) => value });
    engine.registerFilter("raw", (value: unknown) => value);
    return engine;
  }

  #withRaw(source: string, raw: string[], templates?: Template[]): string {
    const rawKeys = new Set(raw);
    const insertions: number[] = [];
    this.#visit(templates ?? new Liquid().parse(source), (template) => {
      if (!(template instanceof Output) || !rawKeys.has(template.token.content.trim())) return;
      insertions.push(template.token.contentRange[1]);
    });
    return insertions.sort((left, right) => right - left).reduce((prepared, position) => `${prepared.slice(0, position)} | ${rawFilter}${prepared.slice(position)}`, source);
  }

  #visit(templates: Template[], visit: (template: Template) => void): void {
    for (const template of templates) {
      visit(template);
      if (template.children !== undefined) this.#visit(toValueSync(template.children(false, true)), visit);
    }
  }

  #assertDefined(uses: string[]): void {
    const visited = new Set<string>();
    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const template = this.#templatesByName.get(name);
      if (template === undefined) throw new UsedTemplateNotFound(name);
      for (const nested of template.uses) visit(nested);
    };
    for (const name of uses) visit(name);
  }

  #hasRecursion(uses: string[]): boolean {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (name: string): boolean => {
      if (visiting.has(name)) return true;
      if (visited.has(name)) return false;
      visiting.add(name);
      for (const nested of this.#templatesByName.get(name)!.uses) if (visit(nested)) return true;
      visiting.delete(name);
      visited.add(name);
      return false;
    };
    return uses.some(visit);
  }

  #owner(owner: string): Pick<TemplateRecord, "uses" | "reads"> | Pick<FillingRecord, "uses" | "reads"> | undefined {
    return this.#templatesByID.get(owner) ?? this.#fillingsByID.get(owner);
  }
}
