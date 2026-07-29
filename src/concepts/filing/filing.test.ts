import { expect, test } from "bun:test";
import { FileNotFound, FilingConcept, PathLeavesRoot } from "./filing.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

test("its principle: file roots are ordered, content-addressed, and contained", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });
  const page = filing.place({ root, path: "posts/compiler-design/index.md", content: bytes("first") });

  expect(page.changed).toBe(true);
  expect(filing.place({ root, path: "posts/compiler-design/index.md", content: bytes("first") }).changed).toBe(false);
  expect(filing.place({ root, path: "posts/compiler-design/index.md", content: bytes("second") }).changed).toBe(true);

  const image = filing.place({ root, path: "posts/compiler-design/pipeline.png", content: bytes("image") });
  expect(filing._under({ root, prefix: "posts/" }).map(({ path }) => path)).toEqual([
    "posts/compiler-design/index.md",
    "posts/compiler-design/pipeline.png",
  ]);
  expect(filing._resolve({ file: page.file, address: "./pipeline.png" })).toEqual([
    { target: image.file, path: "posts/compiler-design/pipeline.png" },
  ]);
  expect(() => filing.place({ root, path: "../escape.md", content: bytes("no") })).toThrow(PathLeavesRoot);

  expect(filing.discard({ file: page.file })).toEqual({ root, path: "posts/compiler-design/index.md" });
  expect(filing._file({ file: page.file })).toEqual([]);
  expect(() => filing.discard({ file: page.file })).toThrow(FileNotFound);
});
