import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { env, platform } from "node:process";

const MAGIC = "syncpress-rendition-v1\n";
const HEADER_LENGTH = MAGIC.length + 65 + 65;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function defaultDirectory(): string {
  const configured = platform === "win32" ? env.LOCALAPPDATA : env.XDG_CACHE_HOME;
  const base = configured !== undefined && isAbsolute(configured)
    ? configured
    : platform === "darwin" ? join(homedir(), "Library", "Caches") : join(homedir(), ".cache");
  return join(base, "syncpress", "images");
}

/** Disposable derived bytes, never authoritative concept state or publication output. */
export class RenditionCache {
  readonly #directory: string | null;

  constructor(directory?: string | null) {
    try {
      this.#directory = directory === undefined ? defaultDirectory() : directory;
    } catch {
      this.#directory = null;
    }
  }

  #path(key: string): string | undefined {
    if (this.#directory === null || !/^[0-9a-f]{64}$/.test(key)) return undefined;
    return join(this.#directory, key.slice(0, 2), `${key}.bin`);
  }

  async read(key: string): Promise<Uint8Array | undefined> {
    const path = this.#path(key);
    if (path === undefined) return undefined;
    try {
      const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0));
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size <= HEADER_LENGTH || stat.size > MAX_ENTRY_BYTES + HEADER_LENGTH) return undefined;
        const entry = await file.readFile();
        const header = entry.subarray(0, HEADER_LENGTH).toString("ascii");
        const content = entry.subarray(HEADER_LENGTH);
        if (entry.length !== stat.size || header !== `${MAGIC}${key}\n${digest(content)}\n`) return undefined;
        return content;
      } finally {
        await file.close();
      }
    } catch {
      // Missing, corrupt, or inaccessible caches must never make a build fail.
      return undefined;
    }
  }

  async write(key: string, content: Uint8Array): Promise<void> {
    const path = this.#path(key);
    if (path === undefined || content.length === 0 || content.length > MAX_ENTRY_BYTES) return;
    const directory = join(this.#directory!, key.slice(0, 2));
    let temporary: string | undefined;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      temporary = await mkdtemp(join(directory, ".tmp-"));
      const staged = join(temporary, "entry");
      const header = Buffer.from(`${MAGIC}${key}\n${digest(content)}\n`, "ascii");
      await writeFile(staged, Buffer.concat([header, content]), { flag: "wx", mode: 0o600 });
      // Readers and concurrent builds see either the old complete entry or the new one.
      await rename(staged, path);
    } catch {
      // A read-only/full cache is just an uncached build.
    } finally {
      if (temporary !== undefined) await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
