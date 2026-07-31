import { resolve } from "node:path";
import { serveSite } from "./server.ts";
import { buildSite, inspectSite, type BuildResult } from "./site.ts";
import { watchSite } from "./watch.ts";

const HELP = `Usage:
  syncpress build [site-directory] [output-directory]
  syncpress build --watch [site-directory] [output-directory]
  syncpress dev [--port PORT] [site-directory] [output-directory]
  syncpress inspect <page-or-route> [site-directory]

Build the configured site rooted at <site-directory>, defaulting to the current
directory. Without an explicit output directory, paths.output (or dist) is used.
`;

function printBuild(result: BuildResult): void {
  console.log(
    `Built ${result.pages} ${result.pages === 1 ? "page" : "pages"} from ${result.inputFiles} ` +
      `${result.inputFiles === 1 ? "input file" : "input files"} ` +
      `(${result.written} written, ${result.replaced} replaced, ${result.kept} kept, ${result.removed} removed).`,
  );
}

async function waitForInterrupt(close: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolveSignal) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolveSignal();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await close();
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h", "help"].includes(args[0]!))) {
    console.log(HELP);
    return;
  }

  if (args[0] === "inspect" && (args.length === 2 || args.length === 3)) {
    console.log(JSON.stringify(await inspectSite(args[2] ?? ".", args[1]!), null, 2));
    return;
  }

  if (args[0] === "dev") {
    const rest = args.slice(1);
    let port = 3000;
    if (rest[0] === "--port") {
      const requested = Number(rest[1]);
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 65_535) throw new Error(`Invalid usage.\n\n${HELP}`);
      port = requested;
      rest.splice(0, 2);
    }
    if (rest.length > 2) throw new Error(`Invalid usage.\n\n${HELP}`);
    const server = await serveSite(rest[0] ?? ".", rest[1], {
      port,
      onError(error) {
        console.error(error instanceof Error ? error.message : String(error));
      },
    });
    console.log(`Serving ${resolve(rest[0] ?? ".")} at http://${server.host}:${server.port}/`);
    await waitForInterrupt(() => server.close());
    return;
  }

  if (args[0] !== "build") throw new Error(`Invalid usage.\n\n${HELP}`);
  if (args[1] === "--watch") {
    if (args.length > 4) throw new Error(`Invalid usage.\n\n${HELP}`);
    const watcher = await watchSite(args[2] ?? ".", args[3], {
      onBuild: printBuild,
      onError(error) {
        console.error(error instanceof Error ? error.message : String(error));
      },
    });
    await waitForInterrupt(() => watcher.close());
    return;
  }
  if (args.length > 3) throw new Error(`Invalid usage.\n\n${HELP}`);

  printBuild(await buildSite(args[1] ?? ".", args[2]));
}
