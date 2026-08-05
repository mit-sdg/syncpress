export class InvalidText extends Error {}
export class InvalidData extends Error {}
export class InvalidProfile extends Error {}
export class InvalidTemplate extends Error {}
export class InvalidAttempt extends Error {}
export class StaleAttempt extends Error {}
export class UnknownSource extends Error {}
export class RenderingNotFound extends Error {}
export class StageNotReady extends Error {}

export type RenderingStage = "started" | "body-settled" | "layout-settled" | "completed" | "superseded";

type RenderingRecord = {
  rendering: string;
  subject: string;
  path: string;
  profile: string;
  template: string;
  stage: RenderingStage;
  order: bigint;
  dependencyAttempt: number;
  emissionAttempt: number;
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function requireText(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidText();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function renderingControls(data: unknown): { profile?: unknown; template?: unknown } {
  if (!isRecord(data)) throw new InvalidData();
  const build = data.build;
  if (!isRecord(build)) return {};
  return {
    ...(Object.hasOwn(build, "markup") ? { profile: build.markup } : {}),
    ...(Object.hasOwn(build, "template") ? { template: build.template } : {}),
  };
}

function selectedProfile(path: string, requested: unknown): string {
  if (requested !== undefined) {
    if (!isText(requested)) throw new InvalidProfile();
    return requested;
  }
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html")) return "verbatim";
  throw new UnknownSource();
}

function selectedTemplate(requested: unknown): string {
  if (requested === undefined) return "page.html";
  if (!isText(requested)) throw new InvalidTemplate();
  return requested;
}

function requireAttempt(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new InvalidAttempt();
}

/** Coordinate observable page rendering attempts without performing peer behavior. */
export class RenderingConcept {
  readonly #attempts = new Map<string, RenderingRecord>();
  readonly #latestBySubject = new Map<string, RenderingRecord>();
  #nextRendering = 1n;

  begin({
    subject,
    path,
    data,
    dependencyAttempt,
    emissionAttempt,
  }: {
    subject: unknown;
    path: unknown;
    data: unknown;
    dependencyAttempt: unknown;
    emissionAttempt: unknown;
  }) {
    requireText(subject);
    requireText(path);
    requireAttempt(dependencyAttempt);
    requireAttempt(emissionAttempt);
    const controls = renderingControls(data);
    const profile = selectedProfile(path, controls.profile);
    const template = selectedTemplate(controls.template);
    const previous = this.#latestBySubject.get(subject);
    if (previous !== undefined) {
      const sameAttempts = previous.dependencyAttempt === dependencyAttempt && previous.emissionAttempt === emissionAttempt;
      if (sameAttempts) {
        if (previous.path !== path || previous.profile !== profile || previous.template !== template) throw new StaleAttempt();
        return {
          rendering: previous.rendering,
          subject,
          profile,
          template,
          dependencyAttempt,
          emissionAttempt,
        };
      }
      if (dependencyAttempt <= previous.dependencyAttempt || emissionAttempt <= previous.emissionAttempt) {
        throw new StaleAttempt();
      }
    }
    if (previous !== undefined && previous.stage !== "completed" && previous.stage !== "superseded") {
      previous.stage = "superseded";
    }

    const order = this.#nextRendering;
    this.#nextRendering += 1n;
    const rendering = `rendering:${order}`;
    const record: RenderingRecord = {
      rendering,
      subject,
      path,
      profile,
      template,
      stage: "started",
      order,
      dependencyAttempt,
      emissionAttempt,
    };
    this.#attempts.set(rendering, record);
    this.#latestBySubject.set(subject, record);
    return { rendering, subject, profile, template, dependencyAttempt, emissionAttempt };
  }

  settleBody({ rendering }: { rendering: unknown }) {
    const record = this.#record(rendering);
    if (record.stage !== "started") return { rendering: record.rendering, subject: record.subject, transitioned: false };
    record.stage = "body-settled";
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  settleLayout({ rendering }: { rendering: unknown }) {
    const record = this.#record(rendering);
    if (record.stage === "started") throw new StageNotReady();
    if (record.stage !== "body-settled") {
      return { rendering: record.rendering, subject: record.subject, transitioned: false };
    }
    record.stage = "layout-settled";
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  finish({ rendering }: { rendering: unknown }) {
    const record = this.#record(rendering);
    if (record.stage === "started" || record.stage === "body-settled") throw new StageNotReady();
    if (record.stage !== "layout-settled") {
      return { rendering: record.rendering, subject: record.subject, transitioned: false };
    }
    record.stage = "completed";
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  _attempt({ rendering }: { rendering: unknown }): Omit<RenderingRecord, "rendering" | "order">[] {
    if (!isText(rendering)) return [];
    const record = this.#attempts.get(rendering);
    return record === undefined ? [] : [this.#row(record)];
  }

  _active({ rendering }: { rendering: unknown }): Omit<RenderingRecord, "rendering" | "order">[] {
    if (!isText(rendering)) return [];
    const record = this.#attempts.get(rendering);
    return record === undefined
      || this.#latestBySubject.get(record.subject) !== record
      || record.stage === "completed"
      || record.stage === "superseded"
      ? []
      : [this.#row(record)];
  }

  _latest({ subject }: { subject: unknown }): Omit<RenderingRecord, "subject" | "order">[] {
    if (!isText(subject)) return [];
    const record = this.#latestBySubject.get(subject);
    return record === undefined
      ? []
      : [{
          rendering: record.rendering,
          path: record.path,
          profile: record.profile,
          template: record.template,
          stage: record.stage,
          dependencyAttempt: record.dependencyAttempt,
          emissionAttempt: record.emissionAttempt,
        }];
  }

  _all(): Omit<RenderingRecord, "order">[] {
    return [...this.#attempts.values()]
      .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0))
      .map(({ order: _order, ...record }) => ({ ...record }));
  }

  #record(rendering: unknown): RenderingRecord {
    const record = isText(rendering) ? this.#attempts.get(rendering) : undefined;
    if (record === undefined) throw new RenderingNotFound();
    return record;
  }

  #row(record: RenderingRecord): Omit<RenderingRecord, "rendering" | "order"> {
    return {
      subject: record.subject,
      path: record.path,
      profile: record.profile,
      template: record.template,
      stage: record.stage,
      dependencyAttempt: record.dependencyAttempt,
      emissionAttempt: record.emissionAttempt,
    };
  }
}
