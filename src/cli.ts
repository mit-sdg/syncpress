import { runCli } from "./edge/cli.ts";

// The operator has already been told what went wrong; only the exit code is left.
try {
  await runCli();
} catch {
  process.exitCode = 1;
}
