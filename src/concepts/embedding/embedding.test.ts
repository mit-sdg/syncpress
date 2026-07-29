import { expect, test } from "bun:test";
import { EmbeddingConcept, EmbeddingNotFound } from "./embedding.ts";

test("its principle: offers gate deterministic responsive image markup", () => {
  const embedding = new EmbeddingConcept();
  const declared = embedding.declare({ subject: "reference", alternative: "Compiler pipeline", width: 1440, height: 900, expects: 4 });

  expect(embedding._markup({ embedding: declared.embedding })).toEqual([]);
  expect(() => embedding.offer({ embedding: "missing", address: "/missing.png", format: "png", width: 1, order: 0 })).toThrow(EmbeddingNotFound);
  embedding.offer({ embedding: declared.embedding, address: "/assets/pipeline-960.png", format: "png", width: 960, order: 3 });
  embedding.offer({ embedding: declared.embedding, address: "/assets/pipeline-960.avif", format: "avif", width: 960, order: 1 });
  embedding.offer({ embedding: declared.embedding, address: "/assets/pipeline-480.avif", format: "avif", width: 480, order: 0 });
  const complete = embedding.offer({ embedding: declared.embedding, address: "/assets/pipeline-480.png", format: "png", width: 480, order: 2 });

  const markup = '<picture><source type="image/avif" srcset="/assets/pipeline-480.avif 480w, /assets/pipeline-960.avif 960w"><img src="/assets/pipeline-960.png" srcset="/assets/pipeline-480.png 480w, /assets/pipeline-960.png 960w" width="1440" height="900" alt="Compiler pipeline" loading="lazy" decoding="async"></picture>';
  expect(complete.arrived).toBe(4);
  expect(embedding._markup({ embedding: declared.embedding })).toEqual([{ markup }]);
  embedding.offer({ embedding: declared.embedding, address: "/assets/pipeline-480.png", format: "png", width: 480, order: 2 });
  expect(embedding._markup({ embedding: declared.embedding })).toEqual([{ markup }]);

  const original = embedding.declare({ subject: "original", alternative: "Original", width: 32, height: 16, expects: 0 });
  expect(embedding._markup({ embedding: original.embedding })).toEqual([
    { markup: '<picture><img width="32" height="16" alt="Original" loading="lazy" decoding="async"></picture>' },
  ]);
});
