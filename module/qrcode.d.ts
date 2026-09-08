/**
 * Error correction level.
 *
 * Higher levels tolerate more damage to the printed symbol but leave less room
 * for data, so the same text may need a larger version.
 */
export declare enum ErrorCorrectionLevel {
	/** Recovers roughly 7% of codewords. */
	LOW = "L",
	/** Recovers roughly 15% of codewords. The usual default. */
	MEDIUM = "M",
	/** Recovers roughly 25% of codewords. */
	QUARTILE = "Q",
	/** Recovers roughly 30% of codewords. */
	HIGH = "H"
}
/**
 * Encoding mode for a segment of data.
 *
 * Narrower modes pack more characters into the same space, so a numeric string
 * encodes far more compactly as {@link NUMERIC} than as {@link BYTE}.
 */
export declare enum Mode {
	/** Digits 0-9. Three characters per 10 bits. */
	NUMERIC = "numeric",
	/** `0-9 A-Z $ % * + - . / :` and space. Two characters per 11 bits. */
	ALPHANUMERIC = "alphanumeric",
	/** Arbitrary bytes, encoded as UTF-8. Eight bits per byte. */
	BYTE = "byte"
}
/** Options accepted when creating a QR code. */
export interface QRCodeOptions {
	/**
	 * Error correction level.
	 * @default ErrorCorrectionLevel.MEDIUM
	 */
	errorCorrectionLevel?: ErrorCorrectionLevel;
	/**
	 * Smallest symbol version to consider (1-40).
	 * @default 1
	 */
	minVersion?: number;
	/**
	 * Largest symbol version to consider (1-40).
	 * @default 40
	 */
	maxVersion?: number;
	/**
	 * Mask pattern to apply (0-7), or -1 to choose the one with the lowest
	 * penalty score as the specification recommends.
	 * @default -1
	 */
	mask?: number;
	/**
	 * Raise the error correction level for free when the chosen version has
	 * room to spare, without growing the symbol.
	 * @default true
	 */
	boostEcc?: boolean;
}
/**
 * A logo drawn over the center of the symbol.
 *
 * Nothing in ISO/IEC 18004 reserves space for a logo. One works only because
 * the error correction codewords can reconstruct the data the logo hides, so
 * the covered area is charged against the same budget that protects the symbol
 * against dirt and damage. {@link QRCode.toSVG} refuses a logo that provably
 * exceeds that budget. Staying well under it is what keeps a code scannable in
 * practice. Prefer {@link ErrorCorrectionLevel.QUARTILE} or
 * {@link ErrorCorrectionLevel.HIGH} whenever a logo is used.
 */
export interface LogoOptions {
	/**
	 * The logo itself, as either a `data:` URI or a complete SVG fragment.
	 *
	 * A string beginning with `<` is treated as markup and **inserted into the
	 * output verbatim**, so it must be well-formed XML and must come from a
	 * source you trust. Give it a `viewBox` and no `width`/`height` so it scales
	 * to the space reserved for it. Anything else is treated as a URI and
	 * referenced from an `<image>` element.
	 *
	 * Avoid `http:` and `https:` URIs. They resolve when the SVG is inlined in a
	 * page, but an SVG loaded through {@link QRCode.toDataURL} into an `<img>`
	 * may not load external resources, and the logo then vanishes with no error.
	 */
	content: string;
	/**
	 * Side length of the logo in modules.
	 * @default 20% of the symbol width, rounded down
	 */
	size?: number;
	/**
	 * Modules of clearance cleared around the logo, so it does not touch the
	 * surrounding pattern.
	 * @default 1
	 */
	padding?: number;
	/**
	 * Fill painted behind the logo, which a logo with transparency will show
	 * through. Use "transparent" to paint nothing.
	 * @default the `light` color of the surrounding symbol
	 */
	background?: string;
	/**
	 * Skip the scannability checks, allowing a logo that covers more than the
	 * error correction can recover or that obscures a finder pattern. The
	 * resulting symbol is very likely to be undecodable.
	 * @default false
	 */
	skipChecks?: boolean;
}
/**
 * A decorative band drawn around the symbol, optionally carrying a caption.
 *
 * The band is added outside the quiet zone rather than painted over it, so the
 * light border a scanner needs to find the symbol stays intact and the image
 * simply grows. A framed code reads as something meant to be scanned, which is
 * why payment and donation pages tend to use one.
 *
 * Because the band is a flat area rather than anything module-like, a framed
 * symbol tolerates a far narrower quiet zone than the four modules the
 * specification asks for, and one or two is common in practice. A `margin` of
 * zero is still refused, since a dark band flush against the modules erases the
 * edge a decoder looks for.
 */
export interface FrameOptions {
	/**
	 * Thickness of the band in modules.
	 * @default 4
	 */
	width?: number;
	/**
	 * Band color.
	 *
	 * A single color paints a flat band. A `{ from, to }` pair shades the four
	 * sides separately, lightest along the top and darkest along the bottom,
	 * which gives the mitered look of a picture frame with visible diagonal
	 * seams at the corners. Both stops of a pair must be hexadecimal, since the
	 * intermediate shades are mixed numerically.
	 *
	 * @default "#333333"
	 */
	fill?: string | {
		from: string;
		to: string;
	};
	/** Caption centered along the top band. */
	title?: string;
	/** Caption centered along the bottom band. */
	caption?: string;
	/**
	 * Color of both captions, unless one of them overrides it.
	 * @default "#ffffff"
	 */
	textColor?: string;
	/**
	 * Color of the top caption, overriding {@link FrameOptions.textColor}.
	 *
	 * Useful when the band is shaded, since a color legible against the light
	 * top of a gradient is often not legible against the dark bottom.
	 *
	 * @default whatever `textColor` resolves to
	 */
	titleColor?: string;
	/**
	 * Color of the bottom caption, overriding {@link FrameOptions.textColor}.
	 * @default whatever `textColor` resolves to
	 */
	captionColor?: string;
	/**
	 * Caption size in modules.
	 *
	 * @default 70% of the band thickness, which fills the band without
	 * crowding its edges
	 */
	fontSize?: number;
	/**
	 * Font stack for the captions.
	 *
	 * Text is drawn as text rather than outlines, so it resolves against fonts
	 * on whatever device renders the SVG and may differ between platforms.
	 *
	 * @default a system sans-serif stack
	 */
	fontFamily?: string;
}
/** Options for {@link QRCode.toSVG}. */
export interface SVGOptions {
	/**
	 * Width of the quiet zone in modules. The specification requires 4, and some
	 * scanners are unreliable with less.
	 * @default 4
	 */
	margin?: number;
	/**
	 * Size of one module in SVG user units.
	 * @default 1
	 */
	scale?: number;
	/**
	 * Color of the dark modules.
	 * @default "#000000"
	 */
	dark?: string;
	/**
	 * Color of the light modules and the quiet zone. Use "transparent" to
	 * leave the background unpainted.
	 * @default "#ffffff"
	 */
	light?: string;
	/**
	 * Value for the SVG `width`/`height` attributes, e.g. `"256"` or `"100%"`.
	 * When omitted the SVG carries only a `viewBox` and scales to its container.
	 */
	size?: number | string;
	/**
	 * Accessible label. Rendered as a `<title>` element.
	 */
	title?: string;
	/**
	 * Emit an XML declaration, needed when writing the SVG to a standalone
	 * `.svg` file rather than inlining it in HTML.
	 * @default false
	 */
	xmlDeclaration?: boolean;
	/**
	 * A logo to draw over the center of the symbol. The modules underneath are
	 * left unpainted rather than covered over.
	 *
	 * Ignored by {@link QRCode.toString}, which has no way to draw one.
	 */
	logo?: LogoOptions;
	/**
	 * A decorative band around the symbol, drawn outside the quiet zone so the
	 * image grows rather than the border being eaten into.
	 *
	 * Ignored by {@link QRCode.toString}.
	 */
	frame?: FrameOptions;
}
/** Options for {@link QRCode.toString}. */
export interface TextOptions {
	/**
	 * Quiet zone width in modules.
	 * @default 2
	 */
	margin?: number;
	/**
	 * Draw with half-height block characters, so the symbol comes out square in
	 * a terminal where cells are taller than they are wide.
	 * @default true
	 */
	compact?: boolean;
	/**
	 * Swap dark and light. Needed for light terminal themes, where an
	 * unswapped code has inverted contrast and will not scan.
	 * @default false
	 */
	inverse?: boolean;
}
/** Smallest QR symbol version. */
export declare const MIN_VERSION = 1;
/** Largest QR symbol version. */
export declare const MAX_VERSION = 40;
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
	/** Row-major module grid; true is dark. */
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
	 * module, which keeps the output small enough to inline in a page or a
	 * data URL.
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

export {};
