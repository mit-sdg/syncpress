import { failCli, runCli } from "./edge/cli.ts";

try {
  await runCli();
} catch {
  await failCli();
}
