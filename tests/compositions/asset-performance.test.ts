import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleSyncpress } from "../../src/assembly.ts";

// This is structural, not a flaky wall-clock assertion: logging must never walk
// the properties of a binary payload, regardless of how many megabytes it holds.
test("binary action payloads reach concepts intact without traversal by occurrence logging", async () => {
  const directory = await mkdtemp(join(tmpdir(), "syncpress-binary-evidence-"));
  try {
    const application = assembleSyncpress();
    const content = new Uint8Array(4 * 1024 * 1024).fill(173);
    Object.defineProperty(content, "doNotEnumeratePayload", {
      enumerable: true,
      get() { throw new Error("Occurrence evidence traversed the binary payload"); },
    });
    const digest = createHash("sha256").update(content).digest("hex");
    const destination = join(directory, "output");
    const { Emitting, Filing } = application.concepts;
    const root = await Filing.ensureRoot({ name: "binary" }) as { root: string };
    const filed = await Filing.putFile({ root: root.root, path: "large.pdf", content });
    expect(filed).toMatchObject({ digest, changed: true });
    await Emitting.configureDestination({ destination, prefix: join(directory, ".publish-") });
    expect(await Emitting.intend({ producer: "download", path: "large.pdf", content, medium: "application/pdf" })).toMatchObject({ digest });
    // Instrumented actions take an input mapping, including zero-input actions.
    expect(await Reflect.apply(Emitting.reconcile, Emitting, [{}])).toEqual({ written: 1, replaced: 0, kept: 0, removed: 0 });
    expect(await readFile(join(destination, "large.pdf"))).toEqual(Buffer.from(content));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);
