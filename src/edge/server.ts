import { lstat, readFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { canonicalPath, containsPath } from "./site.ts";
import { watchSite } from "./watch.ts";

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8";
  return "application/octet-stream";
}

function liveReloadMarkup(html: string): string {
  const script = '<script>new EventSource("/__syncpress/live-reload").onmessage=function(){location.reload()}</script>';
  const closing = html.toLowerCase().lastIndexOf("</body>");
  return closing === -1 ? `${html}${script}` : `${html.slice(0, closing)}${script}${html.slice(closing)}`;
}

async function respondFile(response: ServerResponse, root: string, pathname: string): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (decoded.includes("\\") || decoded.split("/").some((segment) => segment === "..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const requested = resolve(root, `.${decoded}`);
  if (!containsPath(root, requested)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  let file = requested;
  try {
    const status = await lstat(file);
    if (status.isSymbolicLink()) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (status.isDirectory()) file = join(file, "index.html");
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const status = await lstat(file);
    if (!status.isFile() || status.isSymbolicLink()) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(file);
    if (file.endsWith(".html")) {
      response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }).end(liveReloadMarkup(body.toString("utf8")));
    } else {
      response.writeHead(200, { "content-type": contentType(file) }).end(body);
    }
  } catch {
    response.writeHead(404).end("Not found");
  }
}

export type DevelopmentServer = { host: string; port: number; close(): Promise<void> };

/** Serve only reconciled output and notify connected browsers after successful watch rebuilds. */
export async function serveSite(
  projectDirectory = ".",
  destination?: string,
  options: { host?: string; port?: number; onError?: (error: unknown) => void } = {},
): Promise<DevelopmentServer> {
  const clients = new Set<ServerResponse>();
  const siteDirectory = resolve(projectDirectory);
  let outputDirectory = "";
  let outputUpdate = Promise.resolve();
  const watcher = await watchSite(siteDirectory, destination, {
    onBuild(result) {
      const output = resolve(siteDirectory, destination ?? result.policy.outputPath);
      outputUpdate = canonicalPath(output, "output directory").then(
        (target) => {
          outputDirectory = target;
          for (const client of clients) client.write("data: reload\n\n");
        },
        (error) => options.onError?.(error),
      );
    },
    onError: options.onError,
  });
  await outputUpdate;
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 3000;
  const server = createServer((request, response) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${requestedPort}`}`);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (url.pathname === "/__syncpress/live-reload") {
      response.writeHead(200, {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      response.write("retry: 1000\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    void respondFile(response, outputDirectory, url.pathname);
  });
  await new Promise<void>((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(requestedPort, host, () => {
      server.off("error", rejectListening);
      resolveListening();
    });
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : requestedPort;
  return {
    host,
    port,
    async close(): Promise<void> {
      await watcher.close();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise<void>((resolveClosed, rejectClosed) => server.close((error) => error === undefined ? resolveClosed() : rejectClosed(error)));
    },
  };
}
