export { buildSyncpress } from "./edge/application.ts";
export { runCli } from "./edge/cli.ts";
export { serveSite, type DevelopmentServer } from "./edge/server.ts";
export {
  buildSite,
  inspectSite,
} from "./edge/site.ts";
export { watchSite, type SiteWatcher } from "./edge/watch.ts";

import { runCli } from "./edge/cli.ts";

if (import.meta.main) {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
