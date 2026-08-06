export class InvalidText extends Error {}
export class InvalidAttempt extends Error {}
export class StaleAttempt extends Error {}
export class RenderingNotFound extends Error {}
export class StageNotReady extends Error {}

export type RenderTrackingStage = "started" | "body-settled" | "completed" | "failed" | "superseded";

type RenderTrackingRecord = {
  rendering: string;
  subject: string;
  path: string;
  profile: string;
  template: string;
  stage: RenderTrackingStage;
  failure?: string;
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

function requireAttempt(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new InvalidAttempt();
}

/** Coordinate observable page rendering attempts without performing peer behavior. */
export class RenderTrackingConcept {
  readonly #attempts = new Map<string, RenderTrackingRecord>();
  readonly #latestBySubject = new Map<string, RenderTrackingRecord>();
  #nextRendering = 1n;

  begin({
    subject,
    path,
    profile,
    template,
    dependencyAttempt,
    emissionAttempt,
  }: {
    subject: unknown;
    path: unknown;
    profile: unknown;
    template: unknown;
    dependencyAttempt: unknown;
    emissionAttempt: unknown;
  }) {
    requireText(subject);
    requireText(path);
    requireText(profile);
    requireText(template);
    requireAttempt(dependencyAttempt);
    requireAttempt(emissionAttempt);
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
    if (previous !== undefined && previous.stage !== "completed" && previous.stage !== "failed" && previous.stage !== "superseded") {
      previous.stage = "superseded";
    }

    const order = this.#nextRendering;
    this.#nextRendering += 1n;
    const rendering = `rendering:${order}`;
    const record: RenderTrackingRecord = {
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

  completeBody({ rendering }: { rendering: unknown }) {
    const record = this.#record(rendering);
    if (record.stage !== "started") return { rendering: record.rendering, subject: record.subject, transitioned: false };
    record.stage = "body-settled";
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  completeLayout({ rendering }: { rendering: unknown }) {
    const record = this.#record(rendering);
    if (record.stage === "started") throw new StageNotReady();
    if (record.stage !== "body-settled") {
      return { rendering: record.rendering, subject: record.subject, transitioned: false };
    }
    record.stage = "completed";
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  fail({ rendering, reason }: { rendering: unknown; reason: unknown }) {
    const record = this.#record(rendering);
    requireText(reason);
    if (record.stage !== "started" && record.stage !== "body-settled") {
      return { rendering: record.rendering, subject: record.subject, transitioned: false };
    }
    record.stage = "failed";
    record.failure = reason;
    return { rendering: record.rendering, subject: record.subject, transitioned: true };
  }

  _attempt({ rendering }: { rendering: unknown }): Omit<RenderTrackingRecord, "rendering" | "order">[] {
    if (!isText(rendering)) return [];
    const record = this.#attempts.get(rendering);
    return record === undefined ? [] : [this.#row(record)];
  }

  _active({ rendering }: { rendering: unknown }): Omit<RenderTrackingRecord, "rendering" | "order">[] {
    if (!isText(rendering)) return [];
    const record = this.#attempts.get(rendering);
    return record === undefined
      || this.#latestBySubject.get(record.subject) !== record
      || record.stage === "completed"
      || record.stage === "failed"
      || record.stage === "superseded"
      ? []
      : [this.#row(record)];
  }

  _latest({ subject }: { subject: unknown }): Omit<RenderTrackingRecord, "subject" | "order">[] {
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
          failure: record.failure,
          dependencyAttempt: record.dependencyAttempt,
          emissionAttempt: record.emissionAttempt,
        }];
  }

  _all(): Omit<RenderTrackingRecord, "order">[] {
    return [...this.#attempts.values()]
      .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0))
      .map(({ order: _order, ...record }) => ({ ...record }));
  }

  #record(rendering: unknown): RenderTrackingRecord {
    const record = isText(rendering) ? this.#attempts.get(rendering) : undefined;
    if (record === undefined) throw new RenderingNotFound();
    return record;
  }

  #row(record: RenderTrackingRecord): Omit<RenderTrackingRecord, "rendering" | "order"> {
    return {
      subject: record.subject,
      path: record.path,
      profile: record.profile,
      template: record.template,
      stage: record.stage,
      failure: record.failure,
      dependencyAttempt: record.dependencyAttempt,
      emissionAttempt: record.emissionAttempt,
    };
  }
}
