---
title: References, assets, and responsive images
description: Local page links, content assets, public files, scanned HTML attributes, and raster image generation.
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

CSS URLs, SVG-internal URLs, form actions, citations, `srcdoc`, and URL-bearing attributes outside this table are not scanned.

External, site-absolute, and fragment-only references do not perform content-file lookup. A content-relative document link is replaced by the document's canonical route. Safe query strings and fragments are retained.

```md
[Configuration](./configuration.md?source=assets#paths)
```

The generated target for this source is `/syncpress/reference/configuration/?source=assets#paths`.

## Content-relative assets

A relative reference to a non-document file copies the source beside the referencing page's output. If two pages at different routes reference one source file, Syncpress emits one copy at each required page-relative output path.

Missing files, paths that escape the content root, invalid URLs, unsafe retargeting, and references to unpublished documents are build errors.

The download in the [getting-started tutorial](../guides/getting-started.md#verify-local-asset-handling) begins at `content/assets/guide.txt` and is emitted beside that guide's `index.html`.

## Public files

Every regular file below `public/` is copied byte-for-byte with its relative path preserved. Public files bypass responsive image processing. Use `public/` for root-level stylesheets, icons, manifests, robots files, and downloads that need one stable output path.

This site's stylesheet is authored at [`example/public/styles.css`](https://github.com/mit-sdg/syncpress/blob/main/example/public/styles.css) and emitted as `/styles.css` in the output tree.

## Responsive raster images

A local primary `<img src>` enters responsive processing when its source filename has a JPEG, PNG, WebP, GIF, or AVIF extension. Syncpress then requires the bytes to decode as JPEG, PNG/APNG, WebP, GIF, or AVIF. Filename admission and byte validation are separate; a mismatched or corrupt file is an error. Syncpress:

1. resolves the source relative to the content page;
2. validates the image and reads dimensions with EXIF orientation applied;
3. generates configured width and format offers without upscaling;
4. copies the exact original as the fallback beside the page output;
5. writes derived offers below `paths.assets` with digest-based names;
6. replaces the `<img>` with `<picture>` after every required output is staged.

The generated fallback receives intrinsic `width` and `height`, `loading="lazy"`, and `decoding="async"`. Safe authored attributes including `alt`, `class`, `sizes`, `data-*`, and `aria-*` are retained. A safe query string or fragment on the original source is retained on the fallback URL.

Configured formats may be `avif`, `gif`, `jpeg` or `jpg`, `png`, `webp`, and `original`. The exact original fallback is always emitted. Eligible widths below the source width also receive a source-format rendition, independently of the `original` sentinel. Animated output is generated only in a format that preserves animation.

SVG and other filenames outside the raster-extension set use ordinary asset copying. Unsupported or corrupt bytes under an admitted raster filename are build errors; Syncpress does not silently retain a source that entered the raster path but failed validation.

The [introduction](../index.md) contains both paths: `blue.png` becomes a responsive `<picture>`, while `mark.svg` is copied as an ordinary local asset.

## Output collisions

Asset and rendition outputs participate in the same producer-claim checks as pages and deployment files. A public file, page-local copy, or generated rendition cannot silently replace output owned by another producer.
