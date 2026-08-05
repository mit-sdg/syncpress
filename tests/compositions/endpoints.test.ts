import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncpressRuntime } from "../../src/edge/application.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

test("internal endpoints answer every admitted precondition state", async () => {
  const { application, gateway } = createSyncpressRuntime();

  expect(await gateway.invoke("/site/assess", {}, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "PROJECT_NOT_STAGED" },
  });
  const project = await application.concepts.Filing.open({ name: "project" });
  if ("error" in project) throw new Error(project.error);
  expect(await gateway.invoke("/site/assess", {}, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "CONFIGURATION_NOT_STAGED" },
  });
  expect(await gateway.invoke("/site/configure", { destination: "/tmp/output" }, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "CONFIGURATION_NOT_ASSESSED" },
  });
  expect(await gateway.invoke("/site/prepare", {}, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "CONFIGURATION_NOT_ASSESSED" },
  });
});

test("staging crosses the gateway with exact binary content", async () => {
  const { application, gateway } = createSyncpressRuntime();
  const content = Uint8Array.from([0, 1, 127, 128, 255]);
  expect(await gateway.invoke("/site/stage", {
    name: "content",
    filePath: "binary.bin",
    encoded: Buffer.from(content).toString("base64"),
  })).toEqual({ ok: true, value: {} });

  const root = (await application.concepts.Filing._named({ name: "content" }))[0]!.root;
  const file = (await application.concepts.Filing._at({ root, path: "binary.bin" }))[0]!.file;
  expect((await application.concepts.Filing._file({ file }))[0]?.content).toEqual(content);
  expect(await gateway.invoke("/site/stage", { name: "content", filePath: "bad.bin", encoded: "not base64" })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "INVALID_ENCODING" },
  });
});

test("assessment atomically replaces policy and its diagnostics", async () => {
  const { application, gateway } = createSyncpressRuntime();
  const project = await application.concepts.Filing.open({ name: "project" });
  if ("error" in project) throw new Error(project.error);

  await application.concepts.Filing.place({ root: project.root, path: "site.yaml", content: bytes("paths:\n  output: dist\n") });
  const assessed = await gateway.invoke("/site/assess", {}, { timeoutMs: 100 });
  expect(assessed).toMatchObject({
    ok: true,
    value: {
      sources: [
        { name: "content", path: "content" },
        { name: "templates", path: "templates" },
        { name: "public", path: "public" },
      ],
    },
  });
  expect((await gateway.invoke("/site/prepare", {}, { timeoutMs: 100 })).ok).toBe(true);

  await application.concepts.Filing.place({ root: project.root, path: "site.yaml", content: bytes("paths:\n  output: ../outside\n") });
  expect(await gateway.invoke("/site/assess", {}, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "INVALID_CONFIGURATION" },
  });
  await application.whenIdle();
  expect(await application.concepts.Governing._policy()).toEqual([]);
  expect(await application.concepts.Diagnosing._errors()).toHaveLength(1);
  expect(await gateway.invoke("/site/configure", { destination: "/tmp/output" }, { timeoutMs: 100 })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "CONFIGURATION_NOT_ASSESSED" },
  });

  await application.concepts.Filing.place({ root: project.root, path: "site.yaml", content: bytes("paths:\n  output: public\n") });
  expect((await gateway.invoke("/site/assess", {}, { timeoutMs: 100 })).ok).toBe(true);
  await application.whenIdle();
  expect(await application.concepts.Diagnosing._all()).toEqual([]);
  expect((await application.concepts.Governing._paths())[0]?.output).toBe("public");
});

test("reassessment retracts only assessment-owned configuration diagnostics", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-diagnostic-scope-"));
  try {
    const { application, gateway } = createSyncpressRuntime();
    const project = await application.concepts.Filing.open({ name: "project" });
    if ("error" in project) throw new Error(project.error);
    await application.concepts.Filing.place({
      root: project.root,
      path: "site.yaml",
      content: bytes("collections:\n  posts:\n    match: 'posts/**{'\n"),
    });
    const assessed = await gateway.invoke("/site/assess", {});
    expect(assessed.ok).toBe(true);
    const configured = await gateway.invoke("/site/configure", { destination: join(temporary, "output") });
    if (!configured.ok) throw new Error(JSON.stringify(configured.error));
    const started = await application.concepts.Phasing.start({ sequence: configured.value.sequence });
    if ("error" in started) throw new Error(started.error);
    await application.whenIdle();
    expect(await application.concepts.Diagnosing._all()).toContainEqual(expect.objectContaining({
      code: "INVALID_SELECTOR",
      scope: "configuration-settings",
    }));

    await application.concepts.Filing.place({ root: project.root, path: "site.yaml", content: bytes("{}\n") });
    expect((await gateway.invoke("/site/assess", {})).ok).toBe(true);
    await application.whenIdle();
    expect(await application.concepts.Diagnosing._all()).toContainEqual(expect.objectContaining({
      code: "INVALID_SELECTOR",
      scope: "configuration-settings",
    }));

    let attempt: string | null = started.attempt;
    while (attempt !== null) {
      const advanced = await application.concepts.Phasing.advance({ job: started.job, attempt });
      if ("error" in advanced) throw new Error(advanced.error);
      attempt = advanced.attempt;
      await application.whenIdle();
    }
    const restarted = await application.concepts.Phasing.start({ sequence: configured.value.sequence });
    if ("error" in restarted) throw new Error(restarted.error);
    await application.whenIdle();
    expect(await application.concepts.Diagnosing._all()).not.toContainEqual(expect.objectContaining({
      code: "INVALID_SELECTOR",
      scope: "configuration-settings",
    }));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("phase endpoints retry exact barriers and reject superseded reconciliation", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-endpoints-"));
  try {
    const { application, gateway } = createSyncpressRuntime();
    const project = await application.concepts.Filing.open({ name: "project" });
    if ("error" in project) throw new Error(project.error);
    await application.concepts.Filing.place({ root: project.root, path: "site.yaml", content: bytes("{}\n") });
    expect((await gateway.invoke("/site/assess", {})).ok).toBe(true);
    const configured = await gateway.invoke("/site/configure", { destination: join(temporary, "output") });
    if (!configured.ok) throw new Error(JSON.stringify(configured.error));
    const started = await gateway.invoke("/site/start", { sequence: configured.value.sequence });
    if (!started.ok) throw new Error(JSON.stringify(started.error));
    await application.whenIdle();

    const settingsAttempt = started.value.attempt;
    const firstAdvance = await gateway.invoke("/site/advance", { job: started.value.job, attempt: settingsAttempt });
    if (!firstAdvance.ok) throw new Error(JSON.stringify(firstAdvance.error));
    expect(firstAdvance.value).toMatchObject({ phase: "read", transitioned: true });
    const retry = await gateway.invoke("/site/advance", { job: started.value.job, attempt: settingsAttempt });
    expect(retry).toEqual({ ok: true, value: { ...firstAdvance.value, transitioned: false } });
    expect(await gateway.invoke("/site/start", { sequence: configured.value.sequence })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "BUILD_ALREADY_STARTED" },
    });

    let attempt = firstAdvance.value.attempt;
    while (attempt !== null) {
      const advanced = await gateway.invoke("/site/advance", { job: started.value.job, attempt });
      if (!advanced.ok) throw new Error(JSON.stringify(advanced.error));
      attempt = advanced.value.attempt;
      await application.whenIdle();
    }
    expect(await gateway.invoke("/site/start", { sequence: configured.value.sequence })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "BUILD_ALREADY_STARTED" },
    });
    const unrelatedSequence = await application.concepts.Phasing.declare({ name: "unrelated", phases: ["other"] });
    if ("error" in unrelatedSequence) throw new Error(unrelatedSequence.error);
    const unrelated = await application.concepts.Phasing.start({ sequence: unrelatedSequence.sequence });
    if ("error" in unrelated) throw new Error(unrelated.error);
    await application.concepts.Phasing.advance({ job: unrelated.job, attempt: unrelated.attempt });
    expect(await gateway.invoke("/site/reconcile", { job: unrelated.job })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "BUILD_NOT_COMPLETE" },
    });
    const replacement = await application.concepts.Phasing.start({ sequence: configured.value.sequence });
    if ("error" in replacement) throw new Error(replacement.error);
    expect(await gateway.invoke("/site/reconcile", { job: started.value.job })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "BUILD_SUPERSEDED" },
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
