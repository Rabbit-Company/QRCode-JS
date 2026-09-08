/**
 * Error correction level.
 *
 * Higher levels tolerate more damage to the printed symbol but leave less room
 * for data, so the same text may need a larger version.
 */
export enum ErrorCorrectionLevel {
	/** Recovers roughly 7% of codewords. */
	LOW = "L",
	/** Recovers roughly 15% of codewords. The usual default. */
	MEDIUM = "M",
	/** Recovers roughly 25% of codewords. */
	QUARTILE = "Q",
	/** Recovers roughly 30% of codewords. */
	HIGH = "H",
}

/**
 * Encoding mode for a segment of data.
 *
 * Narrower modes pack more characters into the same space, so a numeric string
 * encodes far more compactly as {@link NUMERIC} than as {@link BYTE}.
 */
export enum Mode {
	/** Digits 0-9. Three characters per 10 bits. */
	NUMERIC = "numeric",
	/** `0-9 A-Z $ % * + - . / :` and space. Two characters per 11 bits. */
	ALPHANUMERIC = "alphanumeric",
	/** Arbitrary bytes, encoded as UTF-8. Eight bits per byte. */
	BYTE = "byte",
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
	fill?: string | { from: string; to: string };
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
