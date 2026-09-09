# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-09

### Changed

- **SVG output is roughly 2.6x smaller, and data URLs roughly 2.8x smaller.** Across a spread of payloads and geometries the total went from 58,772 to 22,702 characters for `toSVG`, and from 66,711 to 23,865 for `toDataURL`. A plain short URL at `scale: 8` drops from 2,601 to 1,162 characters. Three things get it there:

  - Each run of dark modules in a row is now drawn as a **stroked horizontal line** one module wide rather than a filled rectangle, which spends 8 characters where the rectangle spent 12.
  - Runs **chain together with relative moves**, so the whole symbol is one absolute `M` followed by short offsets and no coordinate is ever written twice.
  - **`scale` is applied as a `transform` on the path** instead of being multiplied into every coordinate, so the path data holds nothing but small whole numbers and is byte for byte identical at every scale.

  Rows are also walked from the bottom up, which makes the vertical part of every move zero or negative. A minus sign separates two numbers on its own, so past the opening move the path needs no spaces or commas at all. That is worth about a fifth of the data URL, where each separator would otherwise be percent-encoded into three characters.

- **The foreground color now rides on `stroke` rather than `fill`.** The `dark` and `light` options are unchanged and no API moved, so this only matters if you restyle the emitted markup by hand. See the migration note below.

- **Path coordinates are now in modules rather than scaled units.** Previously `scale` was baked into every number, so a fractional scale spilled long decimals through the whole path. The only fractional value left is the single half-module the first line is centred on. Fractional scales gain the most from this release, at 2.80x.

### Fixed

- A fractional `scale` no longer produces long decimal coordinates that inflate the output and lose precision.

### Migration

No code changes are required. If you post-process the generated markup, note that the module path is now:

```svg
<path stroke="#000000" transform="scale(8)" d="M4 28.5h7m1-0h1m3-0h3m4-0h6m-25-1h1m5-0h1m2-..."/>
```

rather than:

```svg
<path fill="#000000" d="M32 32h56v8h-56zM112 32h32v8h-32zM160 32h8v8..."/>
```

So a string replacement targeting `fill="#000000"` on the module path should target `stroke="#000000"` instead. The `transform` attribute is omitted entirely when `scale` is 1. Backing plate, logo plate and frame still use `fill` as before.

### Verification

The rendered geometry is unchanged, not merely equivalent. Both renderers were rasterized across 49 combinations of payload and geometry, covering fractional scale, a zero margin and framed output, at five raster widths chosen to force fractional device scaling. All 245 renderings are pixel-identical to the previous output under librsvg, with an absolute error of 0, and spot checks agree under Gecko. 42 of 42 rasterized symbols decode back to their exact input with jsQR, the other 7 being zero-margin cases that have no quiet zone for a decoder to find.

## [1.0.1] - 2026-09-09

### Changed

- Consecutive dark modules in a row are merged into a single rectangle rather than one rectangle per module, roughly halving the SVG output.

## [1.0.0] - 2026-09-08

### Added

- Initial release. QR code encoding to ISO/IEC 18004, covering all 40 versions, all four error correction levels, all eight mask patterns and optimal mixed-mode segmentation.
- SVG, data URL and terminal output, with options for quiet zone, scale, colors, title, logo and frame.
- Payload builders for WiFi, TOTP, vCard, bitcoin, ERC-20, EPC, GS1, PIX and more.

[1.1.0]: https://github.com/Rabbit-Company/QRCode-JS/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/Rabbit-Company/QRCode-JS/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Rabbit-Company/QRCode-JS/releases/tag/v1.0.0
