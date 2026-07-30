import { earlier, no, reaction, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import {
  CARD_PATHS,
  PARTS,
  PATHS,
  ROOTS,
} from "./shared.ts";

const { Collecting, Composing, Configuring, Converting, Filing, Layering, Matching, Phasing, Routing } = concepts;

const COLLECTIONS_PATH = ["collections"];
const WHERE_PATH = ["where"];
const WHERE_FIELD_PATH = ["where", "field"];

export const CollectionRuleAcceptsPage = view(
  "collection rule (rule) accepts page (page)",
  ({ page, rule }, _outputs, { field, value }) => [
    where(no(Configuring._at({ node: rule, path: WHERE_PATH }))),
    where(
      Configuring._at({ node: rule, path: WHERE_FIELD_PATH }).is({ value: field }),
      Configuring._at({ node: rule, path: PATHS.collectionWhereEquals }).is({ value }),
      Composing._holds({ subject: page, part: PARTS.card, field, value }).is({ equal: true }),
    ),
    where(
      Configuring._at({ node: rule, path: WHERE_FIELD_PATH }).is({ value: field }),
      Configuring._at({ node: rule, path: PATHS.collectionWhereContains }).is({ value }),
      Composing._holds({ subject: page, part: PARTS.card, field, value }).is({ contains: true }),
    ),
    where(
      Configuring._at({ node: rule, path: WHERE_FIELD_PATH }).is({ value: field }),
      Configuring._at({ node: rule, path: PATHS.collectionWhereExists }).is({ value: true }),
      Composing._holds({ subject: page, part: PARTS.card, field, value: null }).is({ present: true }),
    ),
  ],
).holds();

export const MatchingCollectionOfPage = view(
  "matching collection of page (page)",
  ({ page }, { collection, rule, path, card }, { content, configuration, collections, name, text, pattern }) =>
    where(
      Routing._address({ owner: page }),
      Filing._named({ name: ROOTS.content }).is({ root: content }),
      Filing._file({ file: page }).is({ root: content, path }),
      Composing._record({ subject: page, part: PARTS.card }).is({ values: card }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._at({ node: configuration, path: COLLECTIONS_PATH }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ key: name, child: rule }),
      Collecting._named({ name }).is({ collection }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
      Matching._compiled({ text }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      CollectionRuleAcceptsPage({ page, rule }),
    ),
).many();

export const RoutedPagesClearCards = reaction(({ page, root }) =>
  when(Phasing.advance({}).responds({ phase: "collect" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root }),
    )
    .then(Composing.clear({ subject: page, part: PARTS.card })),
);

export const ClearedCardsSetData = reaction(({ page, data }) =>
  when(Composing.clear({ subject: page, part: PARTS.card }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "collect" }),
      Layering._resolved({ subject: page }).is({ values: data }),
    )
    .then(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.data, value: data })),
);

/** Cards keep canonical addresses; the layout reference pass projects the site base once. */
export const CardDataSetsUrl = reaction(({ page, address }) =>
  when(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.data }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "collect" }),
      Routing._address({ owner: page }).is({ address }),
    )
    .then(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.url, value: address })),
);

export const CardUrlSetsExcerpt = reaction(({ page, excerpt }) =>
  when(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.url }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "collect" }),
      whether(Converting._excerpt({ subject: page, part: PARTS.excerpt }).is({ excerpt })),
    )
    .then(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.excerpt, value: excerpt })),
);

export const CardExcerptSetsSourcePath = reaction(({ page, root, path }) =>
  when(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.excerpt }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "collect" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(Composing.set({ subject: page, part: PARTS.card, path: CARD_PATHS.sourcePath, value: path })),
);

export const SortedPagesJoinCollections = reaction(
  ({ page, collection, rule, path, card, sortPath, key }) =>
    when(Composing.set({ part: PARTS.card, path: CARD_PATHS.sourcePath }).responds({ subject: page }))
      .where(
        earlier(Phasing.advance, {}, { phase: "collect" }),
        MatchingCollectionOfPage({ page }).is({ collection, rule, path, card }),
        Configuring._at({ node: rule, path: PATHS.collectionSortBy }).is({ value: sortPath }),
        Composing._field({ subject: page, part: PARTS.card, field: sortPath }).is({ value: key }),
      )
      .then(Collecting.include({ collection, item: page, key, tiebreak: path, card })),
);

export const UnkeyedSortedPagesJoinCollections = reaction(({ page, collection, rule, path, card, sortPath }) =>
  when(Composing.set({ part: PARTS.card, path: CARD_PATHS.sourcePath }).responds({ subject: page }))
    .where(
        earlier(Phasing.advance, {}, { phase: "collect" }),
        MatchingCollectionOfPage({ page }).is({ collection, rule, path, card }),
        Configuring._at({ node: rule, path: PATHS.collectionSortBy }).is({ value: sortPath }),
        no(Composing._field({ subject: page, part: PARTS.card, field: sortPath })),
    )
    .then(Collecting.include({ collection, item: page, tiebreak: path, card })),
);

export const UnsortedPagesJoinCollections = reaction(({ page, collection, rule, path, card }) =>
  when(Composing.set({ part: PARTS.card, path: CARD_PATHS.sourcePath }).responds({ subject: page }))
    .where(
      earlier(Phasing.advance, {}, { phase: "collect" }),
      MatchingCollectionOfPage({ page }).is({ collection, rule, path, card }),
      no(Configuring._at({ node: rule, path: PATHS.collectionSortBy })),
    )
    .then(Collecting.include({ collection, item: page, tiebreak: path, card })),
);
