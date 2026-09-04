---
title: References, assets, and responsive images
description: Local page links, content assets, public files, scanned HTML attributes, and raster image generation.
group: guide
order: 6
topics: [assets, responsive-images, site-building]
---

Syncpress resolves supported HTML references after markup conversion. A content-relative reference can identify a routed document or an ordinary local file. Public files use a separate copy policy.

## Scanned references

The scanner recognizes these locations:

| Elements | Attributes |
| --- | --- |
| `a`, `area`, `base`, `link` | `href` |
| `img`, `input[type=image]` | `src` |
| `img`, `source` | `srcset` candidates |
| `source`, `audio`, `video`, `script`, `iframe`, `embed`, `track` | `src` |
| `video` | `poster` |

Scanning is limited to the table above. CSS URLs, SVG-internal URLs, form actions, citations, and `srcdoc` remain unchanged.

External, site-absolute, and fragment-only references bypass content-file lookup. A content-relative document link is replaced by the document's canonical route. Safe query strings and fragments are retained. After all pages and deployment artifacts are staged, Syncpress checks site-absolute references against the complete route and output set. External URLs and fragment-only references are not checked.

```md
[Configuration](./configuration.md?source=assets#paths)
```

The generated target for this source is `/syncpress/reference/configuration/?source=assets#paths`.

## Content-relative assets

A relative reference to a non-document file copies the source to its content-root-relative output path. Directory structure is preserved, so `content/one/shared.txt` and `content/two/shared.txt` become `one/shared.txt` and `two/shared.txt`. If several pages reference one source file, Syncpress emits one shared copy and rewrites each generated reference to its output URL. The authored relative references remain unchanged and continue to work in source browsers such as GitHub.

References to missing files or unpublished documents produce `MISSING_OUTPUT_REFERENCE` warnings and do not prevent publication. Syncpress projects those references to the URL the missing target would have used, which also lets repeated relative and site-absolute spellings of one target produce a single warning. Paths that escape the content root, invalid URLs, and unsafe retargeting remain build errors.

A site-absolute reference also produces one `MISSING_OUTPUT_REFERENCE` warning when no generated route or output file matches its path. Query strings and fragments do not create separate warnings. Because a static host may provide proxied, legacy, or separately deployed paths, this diagnostic states only that the current build does not produce the target.

The download in the [getting-started tutorial](../guides/getting-started.md#verify-local-asset-handling) begins at `content/assets/guide.txt` and is emitted as `assets/guide.txt`.

## Public files

Every regular file below `public/` is copied byte-for-byte with its relative path preserved. Public files bypass responsive image processing. Use `public/` for root-level stylesheets, icons, manifests, robots files, and downloads that need one stable output path.

This site's stylesheet is authored at [`example/public/styles.css`](https://github.com/mit-sdg/syncpress/blob/main/example/public/styles.css) and emitted as `/styles.css` in the output tree.

## Responsive raster images

A local primary `<img src>` enters responsive processing when its source filename has a JPEG, PNG, WebP, GIF, or AVIF extension. Syncpress then requires the bytes to decode as JPEG, PNG/APNG, WebP, GIF, or AVIF. Filename admission and byte validation are separate; a mismatched or corrupt file is an error. Syncpress:

1. resolves the source relative to the content page;
2. validates the image and reads dimensions with EXIF orientation applied;
3. generates configured width and format offers up to the source width;
4. copies the exact original to its content-root-relative output path;
5. writes derived offers below `paths.assets` with digest-based names;
6. replaces the `<img>` with `<picture>` after every required output is staged.

The generated fallback receives intrinsic `width` and `height`, `loading="lazy"`, and `decoding="async"`. Safe authored attributes including `alt`, `class`, `sizes`, `data-*`, and `aria-*` are retained. A safe query string or fragment on the original source is retained on the fallback URL.

Configured formats may be `avif`, `gif`, `jpeg` or `jpg`, `png`, `webp`, and `original`. The exact original fallback is always emitted. Eligible widths below the source width also receive a source-format rendition, independently of the `original` sentinel. Animated output is generated only in a format that preserves animation.

SVG and other filenames outside the raster-extension set use ordinary asset copying. Unsupported or corrupt bytes under an admitted raster filename are build errors.

The [introduction](../index.md) contains both paths: `blue.png` becomes a responsive `<picture>`, while `mark.svg` is copied as an ordinary local asset.

## Output collisions

Asset and rendition outputs participate in the same producer-claim checks as pages and deployment files. Emitting rejects a public file, content-relative copy, or generated rendition that contests another producer's path.
