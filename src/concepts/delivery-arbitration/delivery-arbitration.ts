const INVALID_TASK = "A delivery task must be a well-formed text identity.";
const DELIVERY_NOT_ACTIVE = "This task has no active aggregate delivery.";

export class InvalidTask extends Error {
  constructor() {
    super(INVALID_TASK);
    this.name = "InvalidTask";
  }
}

export class DeliveryNotActive extends Error {
  constructor() {
    super(DELIVERY_NOT_ACTIVE);
    this.name = "DeliveryNotActive";
  }
}

type Delivery = { active: boolean; interrupted: boolean };

function taskText(value: unknown): string {
  if (typeof value !== "string" || !value.isWellFormed()) throw new InvalidTask();
  return value;
}

/** Keep aggregate answer arbitration local to one task identity. */
export class DeliveryArbitrationConcept {
  readonly #deliveries = new Map<string, Delivery>();

  beginDelivery({ task }: { task: unknown }) {
    const identity = taskText(task);
    const delivery = this.#deliveries.get(identity);
    if (delivery?.active) return { task: identity, changed: false };
    this.#deliveries.set(identity, { active: true, interrupted: delivery?.interrupted ?? false });
    return { task: identity, changed: true };
  }

  recordInterruption({ task }: { task: unknown }) {
    const identity = taskText(task);
    const delivery = this.#deliveries.get(identity);
    if (delivery?.interrupted) return { task: identity, changed: false };
    this.#deliveries.set(identity, { active: delivery?.active ?? false, interrupted: true });
    return { task: identity, changed: true };
  }

  settle({ task }: { task: unknown }) {
    const identity = taskText(task);
    const delivery = this.#deliveries.get(identity);
    if (delivery?.active !== true) throw new DeliveryNotActive();
    this.#deliveries.delete(identity);
    return { task: identity, interrupted: delivery.interrupted };
  }

  _delivery({ task }: { task: unknown }): Delivery[] {
    if (typeof task !== "string" || !task.isWellFormed()) return [];
    const delivery = this.#deliveries.get(task);
    return delivery === undefined ? [] : [{ ...delivery }];
  }
}
