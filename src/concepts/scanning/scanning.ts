import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const INVALID_SURVEY = "A survey needs well-formed, non-empty label and directory text.";
const DIRECTORY_MISSING = "This required directory is missing.";
const DIRECTORY_UNSUPPORTED = "This required location must be a directory that is not a symbolic link.";
const DIRECTORY_UNREADABLE = "This directory could not be read.";
const ENTRY_UNSUPPORTED = "Only directories and ordinary files may be surveyed.";
const ENTRY_UNNAMEABLE = "Every surveyed name must be a portable path segment.";
const ENTRY_NOT_FOUND = "This survey has no such entry.";
const FILE_MISSING = "This required file is missing.";
const ENTRY_UNREADABLE = "This file could not be read.";

export class InvalidSurvey extends Error {
  constructor() {
    super(INVALID_SURVEY);
    this.name = "InvalidSurvey";
  }
}

export class DirectoryMissing extends Error {
  constructor() {
    super(DIRECTORY_MISSING);
    this.name = "DirectoryMissing";
  }
}

export class DirectoryUnsupported extends Error {
  constructor() {
    super(DIRECTORY_UNSUPPORTED);
    this.name = "DirectoryUnsupported";
  }
}

export class DirectoryUnreadable extends Error {
  constructor() {
    super(DIRECTORY_UNREADABLE);
    this.name = "DirectoryUnreadable";
  }
}

export class EntryUnsupported extends Error {
  constructor() {
    super(ENTRY_UNSUPPORTED);
    this.name = "EntryUnsupported";
  }
}

export class EntryUnnameable extends Error {
  constructor() {
    super(ENTRY_UNNAMEABLE);
    this.name = "EntryUnnameable";
  }
}

export class EntryNotFound extends Error {
  constructor() {
    super(ENTRY_NOT_FOUND);
    this.name = "EntryNotFound";
  }
}

export class FileMissing extends Error {
  constructor() {
    super(FILE_MISSING);
    this.name = "FileMissing";
  }
}

export class EntryUnreadable extends Error {
  constructor() {
    super(ENTRY_UNREADABLE);
    this.name = "EntryUnreadable";
  }
}

type Entry = { path: string; source: string };
type SurveyRecord = { survey: string; label: string; directory: string; entries: Map<string, Entry> };

const CONTROL_LIMIT = 0x20;
const DELETE_CODE = 0x7f;

function hasForbiddenCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code < CONTROL_LIMIT || code === DELETE_CODE || character === "/" || character === "\\") return true;
  }
  return false;
}

function isSurveyText(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.isWellFormed();
}

function isPathSegment(value: string): boolean {
  return value !== "" && value !== "." && value !== ".." && value.isWellFormed() &&
    value.normalize("NFC") === value && !hasForbiddenCharacter(value);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function surveyIdentity(label: string): string {
  return `survey:${JSON.stringify(label)}`;
}

function byName(left: { name: string }, right: { name: string }): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

async function readBytes(source: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(source));
  } catch {
    throw new EntryUnreadable();
  }
}

/** Read ordinary host files in one predictable order, refusing anything that is not a plain file. */
export class ScanningConcept {
  readonly #surveysByID = new Map<string, SurveyRecord>();
  readonly #surveysByLabel = new Map<string, SurveyRecord>();

  async survey({ label, directory }: { label: string; directory: string }) {
    if (!isSurveyText(label) || !isSurveyText(directory)) throw new InvalidSurvey();

    let status: Awaited<ReturnType<typeof lstat>>;
    try {
      status = await lstat(directory);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ENOTDIR") throw new DirectoryMissing();
      throw new DirectoryUnreadable();
    }
    if (status.isSymbolicLink() || !status.isDirectory()) throw new DirectoryUnsupported();

    const entries = new Map<string, Entry>();
    await this.#visit(directory, "", entries);

    const previous = this.#surveysByLabel.get(label);
    if (previous !== undefined) this.#surveysByID.delete(previous.survey);
    const record: SurveyRecord = { survey: surveyIdentity(label), label, directory, entries };
    this.#surveysByID.set(record.survey, record);
    this.#surveysByLabel.set(label, record);
    return { survey: record.survey, count: entries.size };
  }

  async #visit(current: string, prefix: string, entries: Map<string, Entry>): Promise<void> {
    let names: { name: string }[];
    try {
      names = await readdir(current, { withFileTypes: true });
    } catch {
      throw new DirectoryUnreadable();
    }

    for (const entry of [...names].sort(byName)) {
      if (!isPathSegment(entry.name)) throw new EntryUnnameable();
      const source = join(current, entry.name);
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

      let status: Awaited<ReturnType<typeof lstat>>;
      try {
        status = await lstat(source);
      } catch {
        throw new DirectoryUnreadable();
      }

      if (status.isSymbolicLink()) throw new EntryUnsupported();
      if (status.isDirectory()) await this.#visit(source, path, entries);
      else if (status.isFile()) entries.set(path, { path, source });
      else throw new EntryUnsupported();
    }
  }

  async read({ survey, path }: { survey: string; path: string }) {
    const entry = this.#surveysByID.get(survey)?.entries.get(path);
    if (entry === undefined) throw new EntryNotFound();
    return { content: await readBytes(entry.source) };
  }

  async absorb({ path }: { path: string }) {
    if (!isSurveyText(path)) throw new InvalidSurvey();

    let status: Awaited<ReturnType<typeof lstat>>;
    try {
      status = await lstat(path);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ENOTDIR") throw new FileMissing();
      throw new EntryUnreadable();
    }
    if (status.isSymbolicLink() || !status.isFile()) throw new EntryUnsupported();

    return { content: await readBytes(path) };
  }

  _survey({ survey }: { survey: string }): { label: string; directory: string; count: number }[] {
    const record = this.#surveysByID.get(survey);
    return record === undefined ? [] : [{ label: record.label, directory: record.directory, count: record.entries.size }];
  }

  _labelled({ label }: { label: string }): { survey: string }[] {
    const record = this.#surveysByLabel.get(label);
    return record === undefined ? [] : [{ survey: record.survey }];
  }

  _entry({ survey }: { survey: string }): Entry[] {
    const record = this.#surveysByID.get(survey);
    return record === undefined ? [] : [...record.entries.values()].map(({ path, source }) => ({ path, source }));
  }
}
