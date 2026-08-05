import { lstat, readFile, realpath } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const INVALID_SERVER = "A server needs a host and a port between 0 and 65535.";
const ADDRESS_UNAVAILABLE = "This address could not be listened on.";
const SERVER_NOT_OPEN = "There is no such open server.";
const SERVER_NOT_FOUND = "There is no such server.";

const RELOAD_PATH = "/__syncpress/live-reload";
const RELOAD_SCRIPT =
  `<script>new EventSource(${JSON.stringify(RELOAD_PATH)}).onmessage=function(){location.reload()}</script>`;
const MAXIMUM_PORT = 65_535;

const MEDIA_TYPES: readonly (readonly [string, string])[] = [
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
];

export class InvalidServer extends Error {
  constructor() {
    super(INVALID_SERVER);
    this.name = "InvalidServer";
  }
}

export class AddressUnavailable extends Error {
  constructor(options?: ErrorOptions) {
    super(ADDRESS_UNAVAILABLE, options);
    this.name = "AddressUnavailable";
  }
}

export class ServerNotOpen extends Error {
  constructor() {
    super(SERVER_NOT_OPEN);
    this.name = "ServerNotOpen";
  }
}

export class ServerNotFound extends Error {
  constructor() {
    super(SERVER_NOT_FOUND);
    this.name = "ServerNotFound";
  }
}

type ServerRecord = {
  server: string;
  host: string;
  port: number;
  open: boolean;
  directory: string | undefined;
  readers: Set<ServerResponse>;
  listener: Server;
};

function isServerText(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.isWellFormed();
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAXIMUM_PORT;
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function mediaType(path: string): string {
  return MEDIA_TYPES.find(([extension]) => path.endsWith(extension))?.[1] ?? "application/octet-stream";
}

function withReloadListener(html: string): string {
  const closing = html.toLowerCase().lastIndexOf("</body>");
  return closing === -1
    ? `${html}${RELOAD_SCRIPT}`
    : `${html.slice(0, closing)}${RELOAD_SCRIPT}${html.slice(closing)}`;
}

/** Answer one request from a published directory, never reaching outside it. */
async function answerFile(response: ServerResponse, directory: string, pathname: string): Promise<void> {
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

  const requested = resolve(directory, `.${decoded}`);
  if (!contains(directory, requested)) {
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
    const resolved = await realpath(file);
    if (!contains(directory, resolved)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const status = await lstat(file);
    if (!status.isFile() || status.isSymbolicLink()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const content = await readFile(resolved);
    if (file.endsWith(".html")) {
      response
        .writeHead(200, { "content-type": mediaType(file), "cache-control": "no-store" })
        .end(withReloadListener(content.toString("utf8")));
    } else {
      response.writeHead(200, { "content-type": mediaType(file) }).end(content);
    }
  } catch {
    response.writeHead(404).end("Not found");
  }
}

/** Answer host requests from one published directory and tell readers when to look again. */
export class ServingConcept {
  readonly #servers = new Map<string, ServerRecord>();
  #next = 0;

  async open({ host, port }: { host: string; port: number }) {
    if (!isServerText(host) || !isPort(port)) throw new InvalidServer();

    this.#next += 1;
    const identity = `server:${this.#next}`;
    const listener = createServer((request, response) => {
      const record = this.#servers.get(identity);
      if (record === undefined || !record.open) {
        response.writeHead(503).end("Site unavailable");
        return;
      }

      let url: URL;
      try {
        url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
      } catch {
        response.writeHead(400).end("Bad request");
        return;
      }

      if (url.pathname === RELOAD_PATH) {
        response.writeHead(200, {
          "cache-control": "no-cache",
          connection: "keep-alive",
          "content-type": "text/event-stream",
        });
        response.write("retry: 1000\n\n");
        record.readers.add(response);
        request.on("close", () => record.readers.delete(response));
        return;
      }

      if (record.directory === undefined) {
        response.writeHead(503).end("Site unavailable");
        return;
      }
      void answerFile(response, record.directory, url.pathname);
    });

    try {
      await new Promise<void>((listening, failed) => {
        listener.once("error", failed);
        listener.listen(port, host, () => {
          listener.off("error", failed);
          listening();
        });
      });
    } catch (error) {
      throw new AddressUnavailable({ cause: error });
    }

    const address = listener.address();
    const bound = typeof address === "object" && address !== null ? address.port : port;
    this.#servers.set(identity, {
      server: identity,
      host,
      port: bound,
      open: true,
      directory: undefined,
      readers: new Set(),
      listener,
    });
    return { server: identity, host, port: bound };
  }

  serve({ server, directory }: { server: string; directory: string }) {
    const record = this.#open(server);
    if (!isServerText(directory)) throw new InvalidServer();
    record.directory = resolve(directory);
    return { server: record.server, directory: record.directory };
  }

  refresh({ server }: { server: string }) {
    const record = this.#open(server);
    let readers = 0;
    for (const reader of record.readers) {
      reader.write("data: reload\n\n");
      readers += 1;
    }
    return { readers };
  }

  async close({ server }: { server: string }) {
    const record = this.#servers.get(server);
    if (record === undefined) throw new ServerNotFound();
    if (!record.open) return { server: record.server };

    record.open = false;
    for (const reader of record.readers) reader.end();
    record.readers.clear();
    await new Promise<void>((closed, failed) =>
      record.listener.close((error) => (error === undefined ? closed() : failed(error)))
    );
    return { server: record.server };
  }

  #open(server: string): ServerRecord {
    const record = this.#servers.get(server);
    if (record === undefined || !record.open) throw new ServerNotOpen();
    return record;
  }

  _server({ server }: { server: string }): {
    host: string;
    port: number;
    state: "open" | "closed";
    directory: string | null;
  }[] {
    const record = this.#servers.get(server);
    return record === undefined
      ? []
      : [{
        host: record.host,
        port: record.port,
        state: record.open ? "open" : "closed",
        directory: record.directory ?? null,
      }];
  }

  _readers({ server }: { server: string }): { readers: number } {
    return { readers: this.#servers.get(server)?.readers.size ?? 0 };
  }
}
