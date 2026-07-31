import { runCli } from "./edge/cli.ts";

try {
  await runCli();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
