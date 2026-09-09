/**
 * A QR code generator with SVG, data URL and terminal output.
 *
 * Encodes text or binary data into QR code symbols following ISO/IEC 18004:
 * all 40 versions, all four error correction levels, all eight mask patterns,
 * and optimal mixed-mode segmentation, so a URL with digits in it fits in a
 * smaller symbol than byte mode alone would need.
 *
 * Start with {@link QRCode.encode}, or with {@link toSVG}, {@link toDataURL}
 * and {@link toText} when one call is enough.
 *
 * @example Encode and render
 * ```typescript
 * import { QRCode, ErrorCorrectionLevel } from "@rabbit-company/qrcode";
 *
 * const qr = QRCode.encode("https://rabbit-company.com", {
 *   errorCorrectionLevel: ErrorCorrectionLevel.HIGH,
 * });
 *
 * console.log(qr.version); // 4
 * console.log(qr.toSVG({ scale: 8 }));
 * ```
 *
 * @example One-shot helpers
 * ```typescript
 * import { toDataURL, toText } from "@rabbit-company/qrcode";
 *
 * image.src = toDataURL("https://rabbit-company.com", { scale: 8 });
 * console.log(toText("https://rabbit-company.com"));
 * ```
 *
 * @module
 */
import { ErrorCorrectionLevel, type QRCodeOptions, type SVGOptions, type TextOptions } from "./types.ts";
/**
 * An encoded QR code symbol.
 *
 * Immutable once built. Create one with {@link QRCode.encode} or
 * {@link QRCode.encodeBinary}, read its shape from {@link QRCode.version} and
 * {@link QRCode.size}, then render it with {@link QRCode.toSVG},
 * {@link QRCode.toDataURL}, {@link QRCode.toString} or {@link QRCode.toArray}.
 *
 * Rendering does not re-encode, so one symbol can be drawn many times at
 * different scales and colors for the cost of a single encode.
 *
 * @example
 * ```typescript
 * import { QRCode, ErrorCorrectionLevel } from "@rabbit-company/qrcode";
 *
 * const qr = QRCode.encode("https://rabbit-company.com", {
 *   errorCorrectionLevel: ErrorCorrectionLevel.HIGH,
 * });
 *
 * console.log(qr.version);              // 4
 * console.log(qr.size);                 // 33
 * console.log(qr.errorCorrectionLevel); // "H"
 * console.log(qr.toSVG({ scale: 8 }));
 * ```
 */
export declare class QRCode {
    /** Symbol version, 1 to 40. Determines the size. */
    readonly version: number;
    /** Side length in modules, always `version * 4 + 17`. */
    readonly size: number;
    /** Error correction level actually used, after any boost. */
    readonly errorCorrectionLevel: ErrorCorrectionLevel;
    /** Mask pattern applied, 0 to 7. */
    readonly mask: number;
    /** Row-major module grid, where true is dark. */
    private readonly modules;
    /** Modules belonging to function patterns, which masking must not touch. */
    private readonly reserved;
    /**
     * Draws a symbol from codewords that already carry their error correction.
     *
     * Private because a symbol is only well formed for codewords built for this
     * exact version and level. Use {@link QRCode.encode} or
     * {@link QRCode.encodeBinary}.
     *
     * @param mask - Pattern 0 to 7, or -1 to pick the lowest-penalty one.
     */
    private constructor();
    /**
     * Encodes text, splitting it into the cheapest mix of encoding modes.
     *
     * The text is broken into numeric, alphanumeric and byte segments by
     * whichever combination produces the smallest symbol, so a URL with a long
     * digit run in it may fit a smaller version than byte mode alone would need.
     *
     * @param text - The text to encode. Encoded as UTF-8 wherever byte mode is
     * used, so any Unicode string is accepted. An empty string is valid and
     * produces a version 1 symbol.
     * @param options - Error correction level, version range, mask and error
     * correction boosting. Every field is optional (see {@link QRCodeOptions}).
     * @returns The encoded symbol, ready to render.
     * @throws {RangeError} when the text does not fit in `options.maxVersion` at
     * the requested level, when `minVersion` exceeds `maxVersion`, when either
     * falls outside 1 to 40 or is not an integer, or when `mask` is outside -1
     * to 7.
     *
     * @example Default settings
     * ```typescript
     * const qr = QRCode.encode("https://rabbit-company.com");
     * console.log(qr.version); // 2
     * ```
     *
     * @example Pinned to one version
     * ```typescript
     * const qr = QRCode.encode("HELLO", { minVersion: 5, maxVersion: 5 });
     * console.log(qr.size); // 37
     * ```
     */
    static encode(text: string, options?: QRCodeOptions): QRCode;
    /**
     * Encodes raw bytes as a single byte-mode segment.
     *
     * Use this for data that is not text, or for text you have already encoded
     * yourself. Because it never switches modes, it can need a larger symbol
     * than {@link QRCode.encode} would for the same content.
     *
     * @param data - The bytes to encode, used as-is with no transcoding.
     * @param options - Same options as {@link QRCode.encode}.
     * @returns The encoded symbol, ready to render.
     * @throws {RangeError} when the data does not fit in `options.maxVersion` at
     * the requested level, or when the version range or mask is out of bounds.
     *
     * @example
     * ```typescript
     * const qr = QRCode.encodeBinary(new Uint8Array([1, 2, 3, 4]));
     * ```
     */
    static encodeBinary(data: Uint8Array, options?: QRCodeOptions): QRCode;
    /**
     * Builds a symbol from segments, choosing the smallest version that holds
     * them and boosting the error correction level if that version has room.
     *
     * @param segmentsFor - Produces the segments for a candidate version, which
     * matters because the character count field widens at versions 10 and 27.
     * @param options - Version range, requested level, mask and boost flag.
     * @returns The finished symbol.
     * @throws {RangeError} when the segments do not fit in `maxVersion`, or when
     * the version range or mask is out of bounds.
     */
    private static fromSegments;
    /**
     * Reads one module of the symbol.
     *
     * Coordinates are in modules, not pixels, and exclude the quiet zone: (0, 0)
     * is the top-left module of the symbol itself.
     *
     * @param x - Column, 0 to {@link QRCode.size} minus 1.
     * @param y - Row, 0 to {@link QRCode.size} minus 1.
     * @returns True when the module is dark. Out-of-range coordinates return
     * false rather than throwing, so a renderer can read across the quiet zone
     * without bounds checks of its own.
     *
     * @example
     * ```typescript
     * const qr = QRCode.encode("https://rabbit-company.com");
     * qr.getModule(0, 0); // true, the corner of a finder pattern
     * qr.getModule(-1, 0); // false, outside the symbol
     * ```
     */
    getModule(x: number, y: number): boolean;
    /**
     * Copies the whole module grid, for rendering the symbol yourself.
     *
     * @returns A fresh row-major grid of {@link QRCode.size} rows by
     * {@link QRCode.size} columns, indexed as `grid[y][x]`, true for dark.
     * Mutating it does not affect the symbol.
     *
     * @example Draw onto a canvas
     * ```typescript
     * const grid = qr.toArray();
     * for (let y = 0; y < grid.length; y++) {
     *   for (let x = 0; x < grid.length; x++) {
     *     if (grid[y][x]) ctx.fillRect(x * 8, y * 8, 8, 8);
     *   }
     * }
     * ```
     */
    toArray(): boolean[][];
    /**
     * Writes one module, ignoring coordinates outside the symbol so the pattern
     * drawing can run past the edges without bounds checks of its own.
     *
     * @param dark - True to set the module dark.
     * @param isFunction - Marks the module as part of a function pattern, which
     * reserves it so masking and codeword placement leave it alone.
     */
    private set;
    /** Draws everything a decoder locates the symbol by. */
    private drawFunctionPatterns;
    /** A 7x7 finder pattern centered at (cx, cy), plus its separator ring. */
    private drawFinder;
    /** A 5x5 alignment pattern centered at (cx, cy). */
    private drawAlignment;
    /**
     * Writes the 15-bit format information, twice.
     *
     * Five data bits (level and mask) are extended with a BCH(15,5) code and
     * masked with 0x5412 so that an all-zero format still has dark modules.
     */
    private drawFormatBits;
    /**
     * Writes the 18-bit version information, present from version 7 up.
     *
     * Six data bits extended with a BCH(18,6) code, placed near the top-right
     * and bottom-left finders.
     */
    private drawVersionBits;
    /**
     * Places codewords in the zigzag order the specification defines: two
     * module columns at a time, right to left, alternating upward and downward,
     * skipping the vertical timing pattern and every reserved module.
     */
    private drawCodewords;
    /** Whether mask `pattern` inverts the module at (x, y). */
    private static maskAt;
    /** XORs a mask over every non-reserved module. */
    private applyMask;
    /**
     * Applies the requested mask, or evaluates all eight and keeps the one with
     * the lowest penalty score.
     */
    private applyBestMask;
    /**
     * Scores the masked symbol against the four penalty rules from
     * ISO/IEC 18004 §8.8.2. Lower is better: the rules discourage the large
     * blocks and finder-like sequences that confuse decoders.
     */
    private penaltyScore;
    /**
     * Applies rules N1 and N3 along a single row or column.
     *
     * `history` holds the lengths of the last seven alternating runs, most
     * recent first, so a finder-like 1:1:3:1:1 sequence can be recognized
     * together with the light space that must flank it.
     */
    private lineScore;
    /**
     * Upper bound on how many modules a logo can hide and still leave the symbol
     * decodable.
     *
     * Reed-Solomon with `k` error correction codewords per block corrects
     * `floor(k / 2)` wrong codewords in that block, and a codeword is eight
     * modules. The bound is optimistic: it assumes the hidden modules spread
     * evenly across every block, which the interleaving of codewords
     * approximates but does not guarantee, and it spends the entire correction
     * budget on the logo, leaving none for print defects, glare or wear. Treat
     * it as the point past which decoding is impossible, not as a target.
     *
     * @returns The number of modules that can be hidden before the symbol is
     * certainly unreadable, for this symbol's version and level.
     */
    private correctableModules;
    /**
     * Works out where a logo sits and which modules it hides, rejecting the
     * placements that are certain to break the symbol.
     *
     * @param logo - The requested logo. `size` defaults to 20% of the symbol
     * width rounded down, `padding` to 1 module.
     * @returns Where to draw the logo and which modules to leave unpainted.
     * @throws {RangeError} when `content` is empty, when `size` or `padding` is
     * out of range, and unless `skipChecks` is set, when the logo would cover a
     * finder pattern or hide more modules than
     * {@link QRCode.correctableModules} allows.
     */
    private placeLogo;
    /**
     * Works out how thick a frame's band is, refusing one that would fuse with
     * the symbol.
     *
     * The specification asks for a quiet zone of four modules, but a band is a
     * flat area rather than anything module-like, so a decoder locates the
     * symbol against it with far less room than that. Framed codes in the wild
     * commonly run one or two modules. What does break is a band flush against
     * the modules, where a dark band merges into the edge of the symbol and the
     * boundary is gone, so one module is the floor.
     *
     * @param frame - The requested frame.
     * @param margin - Quiet zone in modules, which the band sits outside of.
     * @returns The band thickness in modules.
     * @throws {RangeError} when the thickness is not positive, or there is no
     * quiet zone at all.
     */
    private frameBand;
    /**
     * Renders the symbol as an SVG string.
     *
     * The dark modules are emitted as one `<path>` rather than a rectangle per
     * module: each run of dark modules in a row is a stroked horizontal line,
     * and the runs chain together with relative moves. That keeps the output
     * small enough to inline in a page or a data URL. The line is a module wide
     * and centred on the row, so it covers the same band a filled rectangle
     * would, and `scale` is applied as a transform on the element so the path
     * itself holds only small whole numbers.
     *
     * @param options - Quiet zone, module scale, colors, logo and document
     * details (see {@link SVGOptions}). Omitting `size` leaves the SVG with only
     * a `viewBox`, so it scales to whatever container it sits in.
     * @returns A complete `<svg>` element as markup, optionally preceded by an
     * XML declaration.
     * @throws {RangeError} when `margin` is negative or `scale` is not positive.
     * Also when `options.logo` is set and would cover a finder pattern or hide
     * more modules than the error correction can recover (see
     * {@link LogoOptions}).
     *
     * @example Inline in a page
     * ```typescript
     * element.innerHTML = qr.toSVG({ scale: 8, margin: 4, title: "Scan me" });
     * ```
     *
     * @example Fixed pixel size, so one module is exactly 8 pixels
     * ```typescript
     * const svg = qr.toSVG({ scale: 8, margin: 4, size: (qr.size + 8) * 8 });
     * ```
     */
    toSVG(options?: SVGOptions): string;
    /**
     * Draws the plate behind the logo and the logo itself.
     *
     * @param placement - Geometry from {@link QRCode.placeLogo}, in modules.
     * @param margin - Quiet zone in modules, to offset into SVG coordinates.
     * @param scale - SVG user units per module.
     * @param light - Symbol background, used when the logo sets no `background`.
     * @returns The plate and logo markup, to append inside the `<svg>`.
     */
    private renderLogo;
    /**
     * Renders the symbol as an SVG `data:` URL, ready for an `<img src>`.
     *
     * The markup is percent-encoded rather than base64, which keeps it both
     * smaller and readable.
     *
     * @param options - Same options as {@link QRCode.toSVG}. An SVG loaded
     * through an `<img>` may not fetch external resources, so a logo
     * referenced by `http:` or `https:` URL can silently fail to appear. Use a
     * `data:` URI or inline markup instead.
     * @returns A `data:image/svg+xml,...` URL usable as an image source or an
     * anchor `href`.
     * @throws {RangeError} under the same conditions as {@link QRCode.toSVG}.
     *
     * @example
     * ```typescript
     * image.src = qr.toDataURL({ scale: 8 });
     * ```
     */
    toDataURL(options?: SVGOptions): string;
    /**
     * Renders the symbol with Unicode block characters, for a terminal.
     *
     * By default two module rows share one text row, so the result is roughly
     * square in a terminal whose cells are taller than they are wide.
     *
     * @param options - Quiet zone, row packing and inversion (see
     * {@link TextOptions}). An `SVGOptions.logo` has no meaning here and is not
     * accepted, since block characters cannot carry an image.
     * @returns Newline-separated rows with no trailing newline. In the default
     * compact mode there are `ceil((size + margin * 2) / 2)` rows, otherwise one
     * row per module row.
     *
     * @example
     * ```typescript
     * // Light terminals need inverse, or the contrast is reversed and the
     * // code will not scan.
     * console.log(qr.toString({ inverse: true }));
     * ```
     */
    toString(options?: TextOptions): string;
}
/**
 * Encodes text straight to an SVG string, in one call.
 *
 * Shorthand for {@link QRCode.encode} followed by {@link QRCode.toSVG}. Use the
 * two steps separately when you need the symbol's metadata, or when you want to
 * render the same symbol more than once without encoding it again.
 *
 * @param text - The text to encode, segmented as in {@link QRCode.encode}.
 * @param options - Encoding and rendering options in one object. The encoding
 * fields ({@link QRCodeOptions}) go to the encoder and the rendering fields
 * ({@link SVGOptions}) to the renderer, so unrelated fields are ignored
 * by whichever half does not use them.
 * @returns A complete `<svg>` element as markup.
 * @throws {RangeError} when the text does not fit, or when an option is out of
 * range (see {@link QRCode.encode} and {@link QRCode.toSVG}).
 *
 * @example
 * ```typescript
 * import { toSVG } from "@rabbit-company/qrcode";
 *
 * const svg = toSVG("https://rabbit-company.com", { scale: 8 });
 * ```
 */
export declare function toSVG(text: string, options?: QRCodeOptions & SVGOptions): string;
/**
 * Encodes text straight to an SVG data URL, in one call.
 *
 * Shorthand for {@link QRCode.encode} followed by {@link QRCode.toDataURL}.
 *
 * @param text - The text to encode, segmented as in {@link QRCode.encode}.
 * @param options - Encoding and rendering options in one object, split between
 * {@link QRCodeOptions} and {@link SVGOptions} as in {@link toSVG}.
 * @returns A `data:image/svg+xml,...` URL usable as an image source.
 * @throws {RangeError} when the text does not fit, or when an option is out of
 * range (see {@link QRCode.encode} and {@link QRCode.toSVG}).
 *
 * @example
 * ```typescript
 * import { toDataURL } from "@rabbit-company/qrcode";
 *
 * document.querySelector("img").src = toDataURL("https://rabbit-company.com");
 * ```
 */
export declare function toDataURL(text: string, options?: QRCodeOptions & SVGOptions): string;
/**
 * Encodes text straight to terminal-drawable text, in one call.
 *
 * Shorthand for {@link QRCode.encode} followed by {@link QRCode.toString}.
 *
 * @param text - The text to encode, segmented as in {@link QRCode.encode}.
 * @param options - Encoding and rendering options in one object, split between
 * {@link QRCodeOptions} and {@link TextOptions} as in {@link toSVG}.
 * @returns Newline-separated rows of block characters, with no trailing
 * newline.
 * @throws {RangeError} when the text does not fit, or when an encoding option
 * is out of range (see {@link QRCode.encode}).
 *
 * @example
 * ```typescript
 * import { toText } from "@rabbit-company/qrcode";
 *
 * console.log(toText("https://rabbit-company.com"));
 * ```
 */
export declare function toText(text: string, options?: QRCodeOptions & TextOptions): string;
export { ErrorCorrectionLevel, Mode } from "./types.ts";
export type { FrameOptions, LogoOptions, QRCodeOptions, SVGOptions, TextOptions } from "./types.ts";
export { MAX_VERSION, MIN_VERSION } from "./constants.ts";
