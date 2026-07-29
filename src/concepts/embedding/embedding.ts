export class EmbeddingNotFound extends Error {}

type Offer = { offer: string; embedding: string; address: string; format: string; width: number; order: number };
type Embedding = {
  embedding: string;
  subject: string;
  alternative: string;
  width: number;
  height: number;
  expects: number;
  offers: Map<string, Offer>;
};
type OfferGroup = { format: string; order: number; offers: Offer[] };

const mediaByFormat: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jxl: "image/jxl",
  png: "image/png",
  tiff: "image/tiff",
  webp: "image/webp",
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mediaFor(format: string): string {
  return mediaByFormat[format] ?? `image/${format}`;
}

/** Assemble responsive image markup after all promised rendition addresses arrive. */
export class EmbeddingConcept {
  readonly #embeddingsBySubject = new Map<string, Embedding>();
  readonly #embeddingsByID = new Map<string, Embedding>();

  declare({ subject, alternative, width, height, expects }: { subject: string; alternative: string; width: number; height: number; expects: number }) {
    const embedding = this.#embeddingsBySubject.get(subject)?.embedding ?? `embedding:${subject}`;
    const record = { embedding, subject, alternative, width, height, expects, offers: new Map<string, Offer>() };
    this.#embeddingsBySubject.set(subject, record);
    this.#embeddingsByID.set(embedding, record);
    return { embedding };
  }

  offer({ embedding, address, format, width, order }: { embedding: string; address: string; format: string; width: number; order: number }) {
    const record = this.#embeddingsByID.get(embedding);
    if (record === undefined) throw new EmbeddingNotFound();
    const offer = record.offers.get(address)?.offer ?? `offer:${embedding}:${address}`;
    record.offers.set(address, { offer, embedding, address, format, width, order });
    return { offer, embedding, arrived: record.offers.size };
  }

  withdraw({ subject }: { subject: string }) {
    const record = this.#embeddingsBySubject.get(subject);
    if (record !== undefined) {
      this.#embeddingsBySubject.delete(subject);
      this.#embeddingsByID.delete(record.embedding);
    }
    return { embedding: record?.embedding ?? `embedding:${subject}` };
  }

  _embedding({ embedding }: { embedding: string }) {
    const record = this.#embeddingsByID.get(embedding);
    return record === undefined ? { subject: "", expects: 0, arrived: 0 } : { subject: record.subject, expects: record.expects, arrived: record.offers.size };
  }

  _for({ subject }: { subject: string }): { embedding: string; expects: number; arrived: number }[] {
    const record = this.#embeddingsBySubject.get(subject);
    return record === undefined ? [] : [{ embedding: record.embedding, expects: record.expects, arrived: record.offers.size }];
  }

  _offers({ embedding }: { embedding: string }): { address: string; format: string; width: number; order: number }[] {
    const record = this.#embeddingsByID.get(embedding);
    return record === undefined
      ? []
      : [...record.offers.values()]
          .sort((left, right) => left.order - right.order || compareText(left.format, right.format) || left.width - right.width || compareText(left.address, right.address))
          .map(({ address, format, width, order }) => ({ address, format, width, order }));
  }

  _markup({ embedding }: { embedding: string }): { markup: string }[] {
    const record = this.#embeddingsByID.get(embedding);
    if (record === undefined || record.offers.size < record.expects) return [];
    return [{ markup: this.#markup(record) }];
  }

  #markup(embedding: Embedding): string {
    const groups = new Map<string, OfferGroup>();
    for (const offer of embedding.offers.values()) {
      const group = groups.get(offer.format);
      if (group === undefined) {
        groups.set(offer.format, { format: offer.format, order: offer.order, offers: [offer] });
      } else {
        group.order = Math.min(group.order, offer.order);
        group.offers.push(offer);
      }
    }
    const ordered = [...groups.values()]
      .sort((left, right) => left.order - right.order || compareText(left.format, right.format))
      .map((group) => ({
        ...group,
        offers: group.offers.sort((left, right) => left.width - right.width || left.order - right.order || compareText(left.address, right.address)),
      }));
    const alternative = escapeAttribute(embedding.alternative);
    const attributes = `width="${embedding.width}" height="${embedding.height}" alt="${alternative}" loading="lazy" decoding="async"`;
    const fallback = ordered.at(-1);
    if (fallback === undefined) return `<picture><img ${attributes}></picture>`;

    const srcset = (group: OfferGroup): string => group.offers.map((offer) => `${escapeAttribute(offer.address)} ${offer.width}w`).join(", ");
    const sources = ordered.slice(0, -1).map((group) => `<source type="${mediaFor(group.format)}" srcset="${srcset(group)}">`).join("");
    const source = fallback.offers.at(-1)!;
    return `<picture>${sources}<img src="${escapeAttribute(source.address)}" srcset="${srcset(fallback)}" ${attributes}></picture>`;
  }
}
