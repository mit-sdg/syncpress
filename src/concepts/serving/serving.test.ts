import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { InvalidServer, ServerNotFound, ServerNotOpen, ServingConcept } from "./serving.ts";

/** Ask for a path exactly as written, past the normalization a URL client would apply. */
function rawStatus(host: string, port: number, path: string): Promise<number> {
  return new Promise((answered, failed) => {
    const socket = connect({ host, port }, () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}:${port}\r\nConnection: close\r\n\r\n`);
    });
    let received = "";
    socket.on("data", (chunk) => {
      received += chunk.toString("utf8");
      if (!received.includes("\r\n")) return;
      socket.destroy();
      answered(Number(received.split(" ")[1]));
    });
    socket.on("error", failed);
  });
}

let published: string;
let outside: string;

beforeEach(async () => {
  published = await mkdtemp(join(tmpdir(), "serving-"));
  outside = await mkdtemp(join(tmpdir(), "serving-outside-"));
});

afterEach(async () => {
  await rm(published, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("Serving", () => {
  test("its principle: a published directory is answered safely, and readers are told to reload", async () => {
    const serving = new ServingConcept();
    const opened = await serving.open({ host: "127.0.0.1", port: 0 });
    const origin = `http://${opened.host}:${opened.port}`;

    try {
      expect(opened.port).toBeGreaterThan(0);
      expect(serving._server({ server: opened.server })).toEqual([
        { host: "127.0.0.1", port: opened.port, state: "open", directory: null },
      ]);
      expect((await fetch(`${origin}/`)).status).toBe(503);

      await mkdir(join(published, "posts"));
      await writeFile(join(published, "index.html"), "<html><body>Home</body></html>\n");
      await writeFile(join(published, "posts", "index.html"), "<html><body>Posts</body></html>\n");
      await writeFile(join(published, "styles.css"), "body{}\n");
      serving.serve({ server: opened.server, directory: published });

      const home = await fetch(`${origin}/`);
      expect(home.status).toBe(200);
      expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(home.headers.get("cache-control")).toBe("no-store");
      const html = await home.text();
      expect(html).toContain("Home");
      expect(html).toContain("/__syncpress/live-reload");
      expect(html.indexOf("/__syncpress/live-reload")).toBeLessThan(html.indexOf("</body>"));

      expect((await fetch(`${origin}/posts/`)).status).toBe(200);
      const styles = await fetch(`${origin}/styles.css`);
      expect(styles.headers.get("content-type")).toBe("text/css; charset=utf-8");
      expect((await fetch(`${origin}/missing`)).status).toBe(404);

      await writeFile(join(outside, "secret.txt"), "not public\n");
      await symlink(outside, join(published, "escape"));
      expect((await fetch(`${origin}/escape/secret.txt`)).status).toBe(403);
      // Dot segments are normalized away before a request arrives; the rest is answered here.
      expect(await rawStatus(opened.host, opened.port, "/../secret.txt")).toBe(404);
      expect(await rawStatus(opened.host, opened.port, "/%zz")).toBe(400);
      expect(await rawStatus(opened.host, opened.port, "/nested%5Cpath")).toBe(403);

      expect(serving.refresh({ server: opened.server })).toEqual({ readers: 0 });
      expect(serving._readers({ server: opened.server })).toEqual({ readers: 0 });
    } finally {
      await serving.close({ server: opened.server });
    }

    expect(serving._server({ server: opened.server })).toMatchObject([{ state: "closed" }]);
    expect(() => serving.refresh({ server: opened.server })).toThrow(ServerNotOpen);
  });

  test("a reader is told to reload and is counted while it listens", async () => {
    const serving = new ServingConcept();
    const opened = await serving.open({ host: "127.0.0.1", port: 0 });
    const origin = `http://${opened.host}:${opened.port}`;

    try {
      await writeFile(join(published, "index.html"), "<html><body>Home</body></html>\n");
      serving.serve({ server: opened.server, directory: published });

      const listening = await fetch(`${origin}/__syncpress/live-reload`);
      const reader = listening.body!.getReader();
      expect((await reader.read()).value).toEqual(new TextEncoder().encode("retry: 1000\n\n"));
      expect(serving._readers({ server: opened.server })).toEqual({ readers: 1 });

      expect(serving.refresh({ server: opened.server })).toEqual({ readers: 1 });
      expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: reload\n\n");
      await reader.cancel();
    } finally {
      await serving.close({ server: opened.server });
    }
  });

  test("invalid addresses, unknown servers, and closed servers are refused", async () => {
    const serving = new ServingConcept();
    await expect(serving.open({ host: "", port: 0 })).rejects.toBeInstanceOf(InvalidServer);
    await expect(serving.open({ host: "127.0.0.1", port: 70_000 })).rejects.toBeInstanceOf(InvalidServer);
    await expect(serving.close({ server: "server:absent" })).rejects.toBeInstanceOf(ServerNotFound);
    expect(() => serving.serve({ server: "server:absent", directory: published })).toThrow(ServerNotOpen);
    expect(serving._server({ server: "server:absent" })).toEqual([]);
    expect(serving._readers({ server: "server:absent" })).toEqual({ readers: 0 });

    const opened = await serving.open({ host: "127.0.0.1", port: 0 });
    try {
      expect(() => serving.serve({ server: opened.server, directory: "" })).toThrow(InvalidServer);
    } finally {
      await serving.close({ server: opened.server });
    }
  });
});
