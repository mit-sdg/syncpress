import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

export type ExternalGoldenSite = {
  name: string;
  repository: string;
  branch?: string;
  directory?: string;
  installCommand?: readonly string[];
  buildCommand: readonly string[];
  outputDirectory: string;
  environment?: Readonly<Record<string, string>>;
};

/** Add a repository here to exercise its latest branch revision in CI. */
export const externalGoldenSites: readonly ExternalGoldenSite[] = [
  {
    name: "syncpress-template",
    repository: "https://github.com/mit-sdg/syncpress-template.git",
    branch: "main",
    buildCommand: ["npm", "run", "build"],
    outputDirectory: "dist",
  },
];

type Checkout = {
  workingDirectory: string;
  outputDirectory: string;
  revision: string;
};

export type ExternalGoldenResult = {
  revision: string;
  files: Record<string, string>;
};

export async function createCandidatePackage(): Promise<{ path: string; remove(): Promise<void> }> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "syncpress-golden-package-"));
  try {
    await command(["npm", "pack", "--pack-destination", temporaryDirectory], resolve(import.meta.dir, "../.."));
    const archives = (await readdir(temporaryDirectory)).filter((name) => name.endsWith(".tgz"));
    if (archives.length !== 1) throw new Error(`Expected one candidate package, found ${archives.length}`);
    return {
      path: join(temporaryDirectory, archives[0]!),
      remove: () => rm(temporaryDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function buildExternalGolden(
  site: ExternalGoldenSite,
  candidatePackage: string,
): Promise<ExternalGoldenResult> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), `syncpress-golden-${site.name}-`));
  try {
    const checkout = await prepare(site, candidatePackage, temporaryDirectory);
    await command(site.buildCommand, checkout.workingDirectory, site.environment);
    const files = await outputDigests(checkout.outputDirectory);
    await command(site.buildCommand, checkout.workingDirectory, site.environment);
    const repeatedFiles = await outputDigests(checkout.outputDirectory);
    if (JSON.stringify(repeatedFiles) !== JSON.stringify(files)) {
      throw new Error(`${site.name} produced different output when built a second time`);
    }
    return { revision: checkout.revision, files };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function updateExternalGoldens(): Promise<void> {
  const candidatePackage = await createCandidatePackage();
  try {
    for (const site of externalGoldenSites) {
      const result = await buildExternalGolden(site, candidatePackage.path);
      await writeFile(goldenPath(site), `${JSON.stringify({ files: result.files }, null, 2)}\n`);
      console.log(`Updated ${site.name} from ${site.repository}@${result.revision}`);
    }
  } finally {
    await candidatePackage.remove();
  }
}

export function goldenPath(site: ExternalGoldenSite): string {
  return resolve(import.meta.dir, `${site.name}.json`);
}

async function prepare(site: ExternalGoldenSite, candidatePackage: string, temporaryDirectory: string): Promise<Checkout> {
  const projectDirectory = join(temporaryDirectory, "project");
  await command(
    ["git", "clone", "--depth", "1", "--single-branch", "--branch", site.branch ?? "main", site.repository, projectDirectory],
    temporaryDirectory,
  );

  const workingDirectory = inside(projectDirectory, site.directory ?? ".", "site directory");
  const outputDirectory = inside(workingDirectory, site.outputDirectory, "output directory");
  await command(site.installCommand ?? ["npm", "ci"], workingDirectory, site.environment);
  await command(
    ["npm", "install", "--no-save", "--package-lock=false", candidatePackage],
    workingDirectory,
    site.environment,
  );

  return {
    workingDirectory,
    outputDirectory,
    revision: await commandOutput(["git", "rev-parse", "HEAD"], projectDirectory),
  };
}

async function command(
  arguments_: readonly string[],
  workingDirectory: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<void> {
  await commandOutput(arguments_, workingDirectory, environment);
}

async function commandOutput(
  arguments_: readonly string[],
  workingDirectory: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<string> {
  if (arguments_.length === 0) throw new Error("An external golden command cannot be empty");
  const subprocess = Bun.spawn([...arguments_], {
    cwd: workingDirectory,
    env: { ...definedEnvironment(), ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  if (exitCode !== 0) {
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    throw new Error(
      `Command failed (${exitCode}) in ${workingDirectory}: ${arguments_.join(" ")}${output === "" ? "" : `\n${output}`}`,
    );
  }
  return stdout.trim();
}

function definedEnvironment(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function inside(base: string, path: string, label: string): string {
  const location = resolve(base, path);
  const fromBase = relative(base, location);
  if (fromBase === ".." || fromBase.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromBase)) {
    throw new Error(`External golden ${label} must stay inside its checkout: ${path}`);
  }
  return location;
}

async function outputDigests(directory: string, prefix = ""): Promise<Record<string, string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files: Record<string, string> = {};

  for (const entry of entries) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const location = join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await outputDigests(location, path));
    } else if (entry.isFile()) {
      files[path] = createHash("sha256").update(await readFile(location)).digest("hex");
    } else {
      throw new Error(`Expected a regular output file at ${path}`);
    }
  }

  return files;
}
