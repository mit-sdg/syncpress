import { expect, test } from "bun:test";
import { JobNotRunning, NoPhases, PhasingConcept, SequenceNotFound } from "./phasing.ts";

test("its principle: jobs announce phases independently and stop at an outcome", () => {
  const phasing = new PhasingConcept();
  const phases = ["ready", "settings", "read", "route", "excerpt", "collect", "render", "emit"];
  const sequence = phasing.declare({ name: "build", phases });
  expect(phasing.declare({ name: "build", phases })).toEqual({ sequence: sequence.sequence, changed: false });

  const first = phasing.start({ sequence: sequence.sequence, mode: "once" });
  const second = phasing.start({ sequence: sequence.sequence, mode: "once" });
  expect(first.phase).toBe("ready");
  expect(phasing.advance({ job: second.job })).toMatchObject({ phase: "settings" });
  for (const phase of phases.slice(1)) expect(phasing.advance({ job: first.job })).toMatchObject({ phase });
  expect(phasing.advance({ job: first.job })).toMatchObject({ phase: "emit" });
  expect(phasing._job({ job: first.job })).toEqual({ phase: "emit", state: "finished", mode: "once" });
  expect(() => phasing.advance({ job: first.job })).toThrow(JobNotRunning);

  expect(phasing.abandon({ job: second.job, reason: "The configuration is invalid." })).toEqual({ job: second.job, reason: "The configuration is invalid." });
  expect(phasing._outcome({ job: second.job })).toEqual([{ state: "failed", reason: "The configuration is invalid." }]);
  expect(() => phasing.declare({ name: "empty", phases: [] })).toThrow(NoPhases);
  expect(() => phasing.start({ sequence: "missing", mode: "once" })).toThrow(SequenceNotFound);
});
