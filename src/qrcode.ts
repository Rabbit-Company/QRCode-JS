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

import {
	ECC_BLOCKS,
	ECC_CODEWORDS_PER_BLOCK,
	ECC_FORMAT_BITS,
	ECC_ORDER,
	MAX_VERSION,
	MIN_VERSION,
	alignmentPositions,
	dataCodewords,
	eccIndex,
	rawDataModules,
} from "./constants.ts";
import { encode as reedSolomon } from "./reed-solomon.ts";
import { BitBuffer, byteSegment, makeSegments, totalBitLength, writeSegment, type Segment } from "./segment.ts";
import { ErrorCorrectionLevel, type FrameOptions, type LogoOptions, type QRCodeOptions, type SVGOptions, type TextOptions } from "./types.ts";

/** Codewords alternated as padding once the data ends. */
const PAD_CODEWORDS = [0xec, 0x11] as const;

/** Where a logo sits, in modules, and which modules it hides. */
interface LogoPlacement {
	/** Left and top edge of the logo box, which is square and centered. */
	origin: number;
	/** Side length of the logo box. */
	extent: number;
	/** First module of the cleared square, on both axes. */
	clearFrom: number;
	/** One past the last module of the cleared square, on both axes. */
	clearTo: number;
}

/** Penalty weights for mask selection, from ISO/IEC 18004 §8.8.2. */
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

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
export class QRCode {
	/** Symbol version, 1 to 40. Determines the size. */
	readonly version: number;

	/** Side length in modules, always `version * 4 + 17`. */
	readonly size: number;

	/** Error correction level actually used, after any boost. */
	readonly errorCorrectionLevel: ErrorCorrectionLevel;

	/** Mask pattern applied, 0 to 7. */
	readonly mask: number;

	/** Row-major module grid, where true is dark. */
	private readonly modules: boolean[][];

	/** Modules belonging to function patterns, which masking must not touch. */
	private readonly reserved: boolean[][];

	/**
	 * Draws a symbol from codewords that already carry their error correction.
	 *
	 * Private because a symbol is only well formed for codewords built for this
	 * exact version and level. Use {@link QRCode.encode} or
	 * {@link QRCode.encodeBinary}.
	 *
	 * @param mask - Pattern 0 to 7, or -1 to pick the lowest-penalty one.
	 */
	private constructor(version: number, level: ErrorCorrectionLevel, codewords: Uint8Array, mask: number) {
		this.version = version;
		this.size = version * 4 + 17;
		this.errorCorrectionLevel = level;

		this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
		this.reserved = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));

		this.drawFunctionPatterns();
		this.drawCodewords(codewords);
		this.mask = this.applyBestMask(mask);
		this.drawFormatBits(this.mask);
	}

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
	static encode(text: string, options: QRCodeOptions = {}): QRCode {
		// Segmentation depends on the version, because the character count
		// field widens at versions 10 and 27 and that changes what a mode
		// switch costs. So the segments are recomputed for each candidate.
		return QRCode.fromSegments((version) => makeSegments(text, version), options);
	}

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
	static encodeBinary(data: Uint8Array, options: QRCodeOptions = {}): QRCode {
		const segments = [byteSegment(data)];
		return QRCode.fromSegments(() => segments, options);
	}

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
	private static fromSegments(segmentsFor: (version: number) => Segment[], options: QRCodeOptions): QRCode {
		const requested = options.errorCorrectionLevel ?? ErrorCorrectionLevel.MEDIUM;
		const minVersion = clampVersion(options.minVersion ?? MIN_VERSION, "minVersion");
		const maxVersion = clampVersion(options.maxVersion ?? MAX_VERSION, "maxVersion");
		const mask = options.mask ?? -1;
		const boost = options.boostEcc ?? true;

		if (minVersion > maxVersion) throw new RangeError("minVersion cannot be greater than maxVersion.");
		if (mask < -1 || mask > 7) throw new RangeError("mask must be between 0 and 7, or -1 to choose automatically.");

		let version = minVersion;
		let segments: Segment[] = [];
		let usedBits = 0;
		for (; ; version++) {
			if (version > maxVersion) {
				throw new RangeError(`Data is too long: it does not fit in a version ${maxVersion} symbol at error correction level ${requested}.`);
			}
			segments = segmentsFor(version);
			usedBits = totalBitLength(segments, version);
			if (usedBits <= dataCodewords(version, requested) * 8) break;
		}

		let level = requested;
		if (boost) {
			for (const candidate of ECC_ORDER) {
				if (eccIndex(candidate) > eccIndex(level) && usedBits <= dataCodewords(version, candidate) * 8) {
					level = candidate;
				}
			}
		}

		return new QRCode(version, level, buildCodewords(segments, version, level), mask);
	}

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
	getModule(x: number, y: number): boolean {
		if (x < 0 || y < 0 || x >= this.size || y >= this.size) return false;
		return this.modules[y]?.[x] ?? false;
	}

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
	toArray(): boolean[][] {
		return this.modules.map((row) => [...row]);
	}

	/**
	 * Writes one module, ignoring coordinates outside the symbol so the pattern
	 * drawing can run past the edges without bounds checks of its own.
	 *
	 * @param dark - True to set the module dark.
	 * @param isFunction - Marks the module as part of a function pattern, which
	 * reserves it so masking and codeword placement leave it alone.
	 */
	private set(x: number, y: number, dark: boolean, isFunction: boolean): void {
		const row = this.modules[y];
		const reservedRow = this.reserved[y];
		if (row === undefined || reservedRow === undefined) return;
		row[x] = dark;
		if (isFunction) reservedRow[x] = true;
	}

	/** Draws everything a decoder locates the symbol by. */
	private drawFunctionPatterns(): void {
		// Timing patterns: alternating modules along row and column 6.
		for (let i = 0; i < this.size; i++) {
			this.set(6, i, i % 2 === 0, true);
			this.set(i, 6, i % 2 === 0, true);
		}

		this.drawFinder(3, 3);
		this.drawFinder(this.size - 4, 3);
		this.drawFinder(3, this.size - 4);

		// Alignment patterns, skipping the three that would collide with finders.
		const positions = alignmentPositions(this.version);
		const last = positions.length - 1;
		for (let i = 0; i <= last; i++) {
			for (let j = 0; j <= last; j++) {
				const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
				if (!corner) this.drawAlignment(positions[i] as number, positions[j] as number);
			}
		}

		// Reserve the format and version areas. Their contents are written later.
		this.drawFormatBits(0);
		this.drawVersionBits();
	}

	/** A 7x7 finder pattern centered at (cx, cy), plus its separator ring. */
	private drawFinder(cx: number, cy: number): void {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const distance = Math.max(Math.abs(dx), Math.abs(dy));
				const x = cx + dx;
				const y = cy + dy;
				if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
					// Dark at Chebyshev distance 0-1 and 3, light at 2 and 4.
					this.set(x, y, distance !== 2 && distance !== 4, true);
				}
			}
		}
	}

	/** A 5x5 alignment pattern centered at (cx, cy). */
	private drawAlignment(cx: number, cy: number): void {
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
			}
		}
	}

	/**
	 * Writes the 15-bit format information, twice.
	 *
	 * Five data bits (level and mask) are extended with a BCH(15,5) code and
	 * masked with 0x5412 so that an all-zero format still has dark modules.
	 */
	private drawFormatBits(mask: number): void {
		const data = (ECC_FORMAT_BITS[this.errorCorrectionLevel] << 3) | mask;
		let remainder = data;
		for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
		const bits = ((data << 10) | remainder) ^ 0x5412;

		const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;

		// First copy, around the top-left finder.
		for (let i = 0; i <= 5; i++) this.set(8, i, bit(i), true);
		this.set(8, 7, bit(6), true);
		this.set(8, 8, bit(7), true);
		this.set(7, 8, bit(8), true);
		for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i), true);

		// Second copy, split between the other two finders.
		for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(i), true);
		for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(i), true);

		// The dark module is always set, for every symbol.
		this.set(8, this.size - 8, true, true);
	}

	/**
	 * Writes the 18-bit version information, present from version 7 up.
	 *
	 * Six data bits extended with a BCH(18,6) code, placed near the top-right
	 * and bottom-left finders.
	 */
	private drawVersionBits(): void {
		if (this.version < 7) return;

		let remainder = this.version;
		for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
		const bits = (this.version << 12) | remainder;

		for (let i = 0; i < 18; i++) {
			const dark = ((bits >>> i) & 1) !== 0;
			const a = this.size - 11 + (i % 3);
			const b = Math.floor(i / 3);
			this.set(a, b, dark, true);
			this.set(b, a, dark, true);
		}
	}

	/**
	 * Places codewords in the zigzag order the specification defines: two
	 * module columns at a time, right to left, alternating upward and downward,
	 * skipping the vertical timing pattern and every reserved module.
	 */
	private drawCodewords(codewords: Uint8Array): void {
		let index = 0;

		for (let right = this.size - 1; right >= 1; right -= 2) {
			// Column 6 is the vertical timing pattern, so shift past it.
			if (right === 6) right = 5;

			for (let step = 0; step < this.size; step++) {
				for (let column = 0; column < 2; column++) {
					const x = right - column;
					const upward = ((right + 1) & 2) === 0;
					const y = upward ? this.size - 1 - step : step;

					if (this.reserved[y]?.[x] === true) continue;

					const dark = index < codewords.length * 8 && (((codewords[index >>> 3] as number) >>> (7 - (index % 8))) & 1) !== 0;
					this.set(x, y, dark, false);
					index++;
				}
			}
		}
	}

	/** Whether mask `pattern` inverts the module at (x, y). */
	private static maskAt(pattern: number, x: number, y: number): boolean {
		switch (pattern) {
			case 0:
				return (x + y) % 2 === 0;
			case 1:
				return y % 2 === 0;
			case 2:
				return x % 3 === 0;
			case 3:
				return (x + y) % 3 === 0;
			case 4:
				return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
			case 5:
				return ((x * y) % 2) + ((x * y) % 3) === 0;
			case 6:
				return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
			case 7:
				return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
			default:
				throw new RangeError(`Invalid mask pattern: ${pattern}`);
		}
	}

	/** XORs a mask over every non-reserved module. */
	private applyMask(pattern: number): void {
		for (let y = 0; y < this.size; y++) {
			for (let x = 0; x < this.size; x++) {
				if (this.reserved[y]?.[x] === true) continue;
				const row = this.modules[y];
				if (row !== undefined) row[x] = row[x] !== QRCode.maskAt(pattern, x, y);
			}
		}
	}

	/**
	 * Applies the requested mask, or evaluates all eight and keeps the one with
	 * the lowest penalty score.
	 */
	private applyBestMask(requested: number): number {
		if (requested !== -1) {
			this.applyMask(requested);
			return requested;
		}

		let best = 0;
		let bestScore = Number.POSITIVE_INFINITY;

		for (let pattern = 0; pattern < 8; pattern++) {
			this.applyMask(pattern);
			// Format bits participate in the score, so they must reflect the
			// pattern being evaluated.
			this.drawFormatBits(pattern);

			const score = this.penaltyScore();
			if (score < bestScore) {
				bestScore = score;
				best = pattern;
			}

			// XOR is its own inverse, so re-applying restores the grid.
			this.applyMask(pattern);
		}

		this.applyMask(best);
		return best;
	}

	/**
	 * Scores the masked symbol against the four penalty rules from
	 * ISO/IEC 18004 §8.8.2. Lower is better: the rules discourage the large
	 * blocks and finder-like sequences that confuse decoders.
	 */
	private penaltyScore(): number {
		let score = 0;

		// N1: runs of five or more same-colored modules in a row or column.
		// N3: sequences resembling a finder pattern's 1:1:3:1:1 ratio.
		for (let i = 0; i < this.size; i++) {
			score += this.lineScore((j) => this.getModule(j, i));
			score += this.lineScore((j) => this.getModule(i, j));
		}

		// N2: 2x2 blocks of one color.
		for (let y = 0; y < this.size - 1; y++) {
			for (let x = 0; x < this.size - 1; x++) {
				const color = this.getModule(x, y);
				if (color === this.getModule(x + 1, y) && color === this.getModule(x, y + 1) && color === this.getModule(x + 1, y + 1)) {
					score += PENALTY_N2;
				}
			}
		}

		// N4: deviation of the dark-module proportion from 50%, in steps of 5
		// percentage points. |dark*20 - total*10| / total is |percent - 50| / 5.
		let dark = 0;
		for (let y = 0; y < this.size; y++) {
			for (let x = 0; x < this.size; x++) if (this.getModule(x, y)) dark++;
		}
		const total = this.size * this.size;
		const steps = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
		score += steps * PENALTY_N4;

		return score;
	}

	/**
	 * Applies rules N1 and N3 along a single row or column.
	 *
	 * `history` holds the lengths of the last seven alternating runs, most
	 * recent first, so a finder-like 1:1:3:1:1 sequence can be recognized
	 * together with the light space that must flank it.
	 */
	private lineScore(at: (index: number) => boolean): number {
		let score = 0;
		let runColor = false;
		let runLength = 0;
		const history = [0, 0, 0, 0, 0, 0, 0];

		/**
		 * Records a finished run. The very first run is widened by the symbol
		 * size to stand in for the quiet zone outside the symbol, which counts
		 * as light space when matching a finder pattern at the edge.
		 */
		const addRun = (length: number) => {
			if (history[0] === 0) length += this.size;
			history.pop();
			history.unshift(length);
		};

		/**
		 * Counts finder-like patterns ending at the current position: a dark
		 * 1:1:3:1:1 core with at least four modules of light space on one side
		 * and one module on the other.
		 */
		const finderCount = (): number => {
			const n = history[1] as number;
			const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
			if (!core) return 0;
			return (
				((history[0] as number) >= n * 4 && (history[6] as number) >= n ? 1 : 0) + ((history[6] as number) >= n * 4 && (history[0] as number) >= n ? 1 : 0)
			);
		};

		for (let i = 0; i < this.size; i++) {
			const color = at(i);
			if (color === runColor) {
				runLength++;
				if (runLength === 5) score += PENALTY_N1;
				else if (runLength > 5) score += 1;
			} else {
				addRun(runLength);
				if (!runColor) score += finderCount() * PENALTY_N3;
				runColor = color;
				runLength = 1;
			}
		}

		// Terminate: close a trailing dark run, then append the quiet zone
		// beyond the edge as a final light run.
		if (runColor) {
			addRun(runLength);
			runLength = 0;
		}
		addRun(runLength + this.size);
		score += finderCount() * PENALTY_N3;

		return score;
	}

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
	private correctableModules(): number {
		const ecc = eccIndex(this.errorCorrectionLevel);
		const perBlock = ECC_CODEWORDS_PER_BLOCK[ecc]?.[this.version] ?? 0;
		const blocks = ECC_BLOCKS[ecc]?.[this.version] ?? 0;
		return blocks * Math.floor(perBlock / 2) * 8;
	}

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
	private placeLogo(logo: LogoOptions): LogoPlacement {
		const extent = logo.size ?? Math.floor(this.size * 0.2);
		const padding = logo.padding ?? 1;

		if (logo.content.length === 0) throw new RangeError("logo.content cannot be empty.");
		if (!(extent > 0)) throw new RangeError("logo.size must be positive.");
		if (!(padding >= 0)) throw new RangeError("logo.padding cannot be negative.");
		if (extent > this.size) throw new RangeError(`logo.size of ${extent} modules does not fit in a ${this.size} module symbol.`);

		// Centered, so the same range applies to both axes. The cleared region
		// covers every module the padded logo box touches, even partially.
		const origin = (this.size - extent) / 2;
		const clearFrom = Math.max(0, Math.floor(origin - padding));
		const clearTo = Math.min(this.size, Math.ceil(origin + extent + padding));

		if (logo.skipChecks !== true) {
			// The cleared region is centered and square, so it reaches a finder
			// pattern exactly when it extends into the outer eight rows: the
			// top-left finder and its separator occupy [0, 8) on both axes.
			if (clearFrom < 8) {
				throw new RangeError(
					`A logo of ${extent} modules would cover a finder pattern, which a scanner needs to locate the symbol at all. ` +
						`Reduce logo.size or logo.padding, or encode more data so the symbol grows.`,
				);
			}

			const hidden = (clearTo - clearFrom) ** 2;
			const correctable = this.correctableModules();
			if (hidden > correctable) {
				throw new RangeError(
					`A logo of ${extent} modules hides ${hidden} modules, more than the ${correctable} that error correction level ` +
						`${this.errorCorrectionLevel} can recover in a version ${this.version} symbol. Reduce logo.size, raise ` +
						`errorCorrectionLevel, or raise minVersion so the symbol has more room.`,
				);
			}
		}

		return { origin, extent, clearFrom, clearTo };
	}

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
	private frameBand(frame: FrameOptions, margin: number): number {
		const band = frame.width ?? 4;
		if (!(band > 0)) throw new RangeError("frame.width must be positive.");
		if (margin < 1) {
			throw new RangeError(
				"a frame needs a quiet zone of at least 1 module to sit outside of, or a dark band merges into the edge of the symbol. Raise margin to 1 or more, or drop the frame.",
			);
		}
		return band;
	}

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
	toSVG(options: SVGOptions = {}): string {
		const margin = options.margin ?? 4;
		const scale = options.scale ?? 1;
		const dark = options.dark ?? "#000000";
		const light = options.light ?? "#ffffff";

		if (margin < 0) throw new RangeError("margin cannot be negative.");
		if (scale <= 0) throw new RangeError("scale must be positive.");

		const band = options.frame === undefined ? 0 : this.frameBand(options.frame, margin);
		const inner = (this.size + margin * 2) * scale;
		const extent = inner + band * scale * 2;
		const offset = band * scale;
		const placement = options.logo === undefined ? undefined : this.placeLogo(options.logo);

		// Modules under the logo are left out of the path rather than painted
		// over, so a logo with transparency shows the background through
		// instead of a module edge. An absent logo clears an empty range.
		const clearFrom = placement?.clearFrom ?? 0;
		const clearTo = placement?.clearTo ?? 0;

		// Consecutive dark modules in a row become one horizontal line, stroked
		// at a width of one module and centred on the middle of the row, which
		// covers exactly the same band as a filled rectangle would. Each run
		// after the first is reached by a relative move from where the previous
		// one ended, so no coordinate is ever repeated and the runs of a whole
		// symbol chain into a single `M` followed by short offsets.
		//
		// Coordinates stay in modules and `scale` is left to a transform on the
		// element, which keeps every number a small integer no matter how the
		// symbol is scaled. Only the half-module the first line is centred on is
		// ever fractional. Every later move is a whole number of modules.
		//
		// Rows are walked upwards so that the vertical part of every move is
		// zero or negative and can be written with a leading minus. A sign
		// separates two numbers on its own, so past the opening move the path
		// needs no spaces or commas at all. That is what the odd-looking `-0`
		// buys: `toDataURL` percent-encodes a separator into three characters.
		const shift = margin + band;
		const parts: string[] = [];
		let penX = 0;
		let penY = 0;
		for (let y = this.size - 1; y >= 0; y--) {
			const clearedRow = y >= clearFrom && y < clearTo;
			let start = -1;
			for (let x = 0; x <= this.size; x++) {
				const cleared = clearedRow && x >= clearFrom && x < clearTo;
				const on = x < this.size && !cleared && this.getModule(x, y);
				if (on) {
					if (start === -1) start = x;
					continue;
				}
				if (start === -1) continue;
				const width = x - start;
				const column = start + shift;
				if (parts.length === 0) parts.push(`M${column} ${y + shift}.5h${width}`);
				else parts.push(`m${column - penX}-${penY - y}h${width}`);
				penX = column + width;
				penY = y;
				start = -1;
			}
		}

		const dimensions = options.size === undefined ? "" : ` width="${options.size}" height="${options.size}"`;
		const title = options.title === undefined ? "" : `<title>${escapeXml(options.title)}</title>`;
		const background = light === "transparent" ? "" : `<rect x="${offset}" y="${offset}" width="${inner}" height="${inner}" fill="${escapeXml(light)}"/>`;
		const declaration = options.xmlDeclaration === true ? `<?xml version="1.0" encoding="UTF-8"?>` : "";
		const logo = placement === undefined || options.logo === undefined ? "" : this.renderLogo(options.logo, placement, margin + band, scale, light);
		const frame = options.frame === undefined ? "" : renderFrame(options.frame, band, extent, scale);
		const transform = scale === 1 ? "" : ` transform="scale(${scale})"`;

		return (
			`${declaration}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"${dimensions} ` +
			`shape-rendering="crispEdges" role="img">${title}${frame}${background}` +
			`<path stroke="${escapeXml(dark)}"${transform} d="${parts.join("")}"/>${logo}</svg>`
		);
	}

	/**
	 * Draws the plate behind the logo and the logo itself.
	 *
	 * @param placement - Geometry from {@link QRCode.placeLogo}, in modules.
	 * @param margin - Quiet zone in modules, to offset into SVG coordinates.
	 * @param scale - SVG user units per module.
	 * @param light - Symbol background, used when the logo sets no `background`.
	 * @returns The plate and logo markup, to append inside the `<svg>`.
	 */
	private renderLogo(logo: LogoOptions, placement: LogoPlacement, margin: number, scale: number, light: string): string {
		const plateOffset = (placement.clearFrom + margin) * scale;
		const plateExtent = (placement.clearTo - placement.clearFrom) * scale;
		const offset = (placement.origin + margin) * scale;
		const extent = placement.extent * scale;

		const fill = logo.background ?? light;
		const plate =
			fill === "transparent" ? "" : `<rect x="${plateOffset}" y="${plateOffset}" width="${plateExtent}" height="${plateExtent}" fill="${escapeXml(fill)}"/>`;

		// The root carries shape-rendering="crispEdges" to keep module edges
		// sharp, which would leave a vector logo jagged, so the logo opts back
		// into normal anti-aliasing.
		const box = `x="${offset}" y="${offset}" width="${extent}" height="${extent}"`;
		const art = logo.content.trimStart().startsWith("<")
			? `<svg ${box} overflow="hidden" shape-rendering="auto">${logo.content}</svg>`
			: `<image ${box} shape-rendering="auto" preserveAspectRatio="xMidYMid meet" href="${escapeXml(logo.content)}"/>`;

		return plate + art;
	}

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
	toDataURL(options: SVGOptions = {}): string {
		return `data:image/svg+xml,${encodeURIComponent(this.toSVG(options))}`;
	}

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
	toString(options: TextOptions = {}): string {
		const margin = options.margin ?? 2;
		const compact = options.compact ?? true;
		const inverse = options.inverse ?? false;

		// A dark module must print dark, so the sense flips for light themes.
		const isDark = (x: number, y: number): boolean => {
			const outside = x < margin || y < margin || x >= this.size + margin || y >= this.size + margin;
			const dark = outside ? false : this.getModule(x - margin, y - margin);
			return inverse ? !dark : dark;
		};

		const width = this.size + margin * 2;
		const height = this.size + margin * 2;
		const lines: string[] = [];

		if (!compact) {
			for (let y = 0; y < height; y++) {
				let line = "";
				for (let x = 0; x < width; x++) line += isDark(x, y) ? "██" : "  ";
				lines.push(line);
			}
			return lines.join("\n");
		}

		for (let y = 0; y < height; y += 2) {
			let line = "";
			for (let x = 0; x < width; x++) {
				const top = isDark(x, y);
				// An odd final row pairs with a light module below.
				const bottom = y + 1 < height ? isDark(x, y + 1) : inverse;
				if (top && bottom) line += "█";
				else if (top) line += "▀";
				else if (bottom) line += "▄";
				else line += " ";
			}
			lines.push(line);
		}

		return lines.join("\n");
	}
}

/**
 * Turns the segments into the final interleaved codeword sequence.
 *
 * Data is padded to capacity, split into blocks, given Reed-Solomon parity,
 * then interleaved so that damage to one region of the symbol is spread across
 * every block rather than destroying one entirely.
 */
function buildCodewords(segments: Segment[], version: number, level: ErrorCorrectionLevel): Uint8Array {
	const capacityBits = dataCodewords(version, level) * 8;

	const bits = new BitBuffer();
	for (const segment of segments) writeSegment(segment, version, bits);

	// Terminator: up to four zero bits, truncated if capacity is nearly full.
	bits.push(0, Math.min(4, capacityBits - bits.length));
	bits.push(0, (8 - (bits.length % 8)) % 8);
	for (let i = 0; bits.length < capacityBits; i++) {
		bits.push(PAD_CODEWORDS[i % 2] as number, 8);
	}

	const data = bits.toBytes();

	const ecc = eccIndex(level);
	const blockCount = ECC_BLOCKS[ecc]?.[version] as number;
	const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecc]?.[version] as number;
	const totalCodewords = Math.floor(rawDataModules(version) / 8);
	const shortBlockLength = Math.floor(totalCodewords / blockCount) - eccPerBlock;
	// The last few blocks carry one extra data codeword each.
	const longBlockCount = totalCodewords % blockCount;

	const dataBlocks: Uint8Array[] = [];
	const eccBlocks: Uint8Array[] = [];

	for (let i = 0, offset = 0; i < blockCount; i++) {
		const length = shortBlockLength + (i >= blockCount - longBlockCount ? 1 : 0);
		const block = data.subarray(offset, offset + length);
		offset += length;
		dataBlocks.push(block);
		eccBlocks.push(reedSolomon(block, eccPerBlock));
	}

	const result = new Uint8Array(totalCodewords);
	let index = 0;

	// Interleave data codewords. Short blocks have no codeword at the final
	// column, so that position is skipped for them.
	const longestBlock = shortBlockLength + (longBlockCount > 0 ? 1 : 0);
	for (let column = 0; column < longestBlock; column++) {
		for (const block of dataBlocks) {
			if (column < block.length) result[index++] = block[column] as number;
		}
	}

	// Interleave error correction codewords. Every block has the same count.
	for (let column = 0; column < eccPerBlock; column++) {
		for (const block of eccBlocks) result[index++] = block[column] as number;
	}

	return result;
}

/**
 * Checks a version bound and returns it unchanged.
 *
 * @param name - Option name to quote in the error, so the caller learns which
 * of `minVersion` and `maxVersion` was wrong.
 * @throws {RangeError} when the version is not an integer from
 * {@link MIN_VERSION} to {@link MAX_VERSION}.
 */
function clampVersion(version: number, name: string): number {
	if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
		throw new RangeError(`${name} must be an integer between ${MIN_VERSION} and ${MAX_VERSION}.`);
	}
	return version;
}

/** Ratios at which each side of a framed border is mixed between its two stops. */
const FRAME_SHADES = { top: 0, left: 0.26, right: 0.5, bottom: 1 } as const;

/**
 * Reads a three or six digit hexadecimal color.
 *
 * @param color - The color to read, with its leading `#`.
 * @returns The red, green and blue components, or undefined when the color is
 * not hexadecimal.
 */
function parseHex(color: string): [number, number, number] | undefined {
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
	if (short !== null) {
		return [0, 1, 2].map((i) => Number.parseInt((short[i + 1] as string).repeat(2), 16)) as [number, number, number];
	}
	const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
	if (long === null) return undefined;
	return [0, 1, 2].map((i) => Number.parseInt(long[i + 1] as string, 16)) as [number, number, number];
}

/**
 * Mixes two hexadecimal colors.
 *
 * @param from - Color at ratio zero.
 * @param to - Color at ratio one.
 * @param ratio - Position between the two.
 * @returns The blended color as `#rrggbb`.
 * @throws {RangeError} when either color is not hexadecimal, since a named
 * color cannot be blended arithmetically.
 */
function mixHex(from: string, to: string, ratio: number): string {
	const a = parseHex(from);
	const b = parseHex(to);
	if (a === undefined || b === undefined) {
		throw new RangeError(`a shaded frame needs hexadecimal colors, so "${a === undefined ? from : to}" cannot be used. Pass a single color instead.`);
	}
	const channel = (index: number): string =>
		Math.round((a[index] as number) + ((b[index] as number) - (a[index] as number)) * ratio)
			.toString(16)
			.padStart(2, "0");
	return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * Escapes the five XML predefined entities.
 *
 * Applied to every caller-supplied string that reaches an attribute value or
 * text node, so a color or title containing a quote or angle bracket cannot
 * break out of the markup.
 *
 * @returns The value with `& < > " '` replaced by their entities.
 */
function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Draws the decorative band around a symbol.
 *
 * A single color paints one rectangle. A pair of stops paints four trapezoids
 * instead, each with its own shade, so the corners show the diagonal seams of
 * a mitered picture frame.
 *
 * @param frame - The requested frame.
 * @param band - Band thickness in modules.
 * @param extent - Side length of the whole canvas in user units.
 * @param scale - User units per module.
 * @returns The band and caption markup, to place under the symbol.
 * @throws {RangeError} when a shaded frame is given a color that is not
 * hexadecimal.
 */
function renderFrame(frame: FrameOptions, band: number, extent: number, scale: number): string {
	const fill = frame.fill ?? "#333333";
	const thickness = band * scale;
	const far = extent - thickness;

	let panels: string;
	if (typeof fill === "string") {
		panels = `<rect width="${extent}" height="${extent}" fill="${escapeXml(fill)}"/>`;
	} else {
		// Each side is a trapezoid, so the miter joints fall on the diagonals.
		const sides = {
			top: `0,0 ${extent},0 ${far},${thickness} ${thickness},${thickness}`,
			right: `${extent},0 ${extent},${extent} ${far},${far} ${far},${thickness}`,
			bottom: `${extent},${extent} 0,${extent} ${thickness},${far} ${far},${far}`,
			left: `0,${extent} 0,0 ${thickness},${thickness} ${thickness},${far}`,
		} as const;
		panels = (Object.keys(sides) as (keyof typeof sides)[])
			.map((side) => `<polygon points="${sides[side]}" fill="${mixHex(fill.from, fill.to, FRAME_SHADES[side])}"/>`)
			.join("");
	}

	const shared = frame.textColor ?? "#ffffff";
	const family = escapeXml(frame.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
	const fontSize = frame.fontSize === undefined ? thickness * 0.7 : frame.fontSize * scale;

	const label = (value: string | undefined, y: number, color: string): string =>
		value === undefined
			? ""
			: `<text x="${extent / 2}" y="${y}" fill="${escapeXml(color)}" font-family="${family}" font-size="${fontSize}" ` +
				`text-anchor="middle" dominant-baseline="central">${escapeXml(value)}</text>`;

	const top = label(frame.title, thickness / 2, frame.titleColor ?? shared);
	const foot = label(frame.caption, extent - thickness / 2, frame.captionColor ?? shared);

	// The root keeps module edges crisp, which would leave the miter joints and
	// the captions jagged, so the band opts back into anti-aliasing.
	return `<g shape-rendering="auto">${panels}${top}${foot}</g>`;
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
export function toSVG(text: string, options: QRCodeOptions & SVGOptions = {}): string {
	return QRCode.encode(text, options).toSVG(options);
}

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
export function toDataURL(text: string, options: QRCodeOptions & SVGOptions = {}): string {
	return QRCode.encode(text, options).toDataURL(options);
}

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
export function toText(text: string, options: QRCodeOptions & TextOptions = {}): string {
	return QRCode.encode(text, options).toString(options);
}

export { ErrorCorrectionLevel, Mode } from "./types.ts";
export type { FrameOptions, LogoOptions, QRCodeOptions, SVGOptions, TextOptions } from "./types.ts";
export { MAX_VERSION, MIN_VERSION } from "./constants.ts";
