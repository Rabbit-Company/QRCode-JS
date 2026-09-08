import { ALPHANUMERIC_CHARSET, CHAR_COUNT_BITS, MODE_BITS, versionGroup } from "./constants.ts";
import { Mode } from "./types.ts";

/** A run of data sharing one encoding mode. */
export interface Segment {
	/** Encoding mode the payload was packed with. */
	mode: Mode;
	/** Character count as the specification counts it for this mode. */
	length: number;
	/** The encoded payload, excluding mode and length indicators. */
	bits: BitBuffer;
}

/** Growable most-significant-bit-first bit stream. */
export class BitBuffer {
	/** One entry per bit, each 0 or 1, in the order they were pushed. */
	private readonly bits: number[] = [];

	/** Number of bits held so far. */
	get length(): number {
		return this.bits.length;
	}

	/** Appends the low `count` bits of `value`, most significant first. */
	push(value: number, count: number): void {
		for (let i = count - 1; i >= 0; i--) {
			this.bits.push((value >>> i) & 1);
		}
	}

	/** Appends every bit of `other`, leaving it unchanged. */
	append(other: BitBuffer): void {
		this.bits.push(...other.bits);
	}

	/** Pads to a byte boundary and returns the bytes. */
	toBytes(): Uint8Array {
		const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
		this.bits.forEach((bit, index) => {
			if (bit === 1) bytes[index >>> 3] = (bytes[index >>> 3] as number) | (0x80 >>> (index % 8));
		});
		return bytes;
	}
}

/** Matches a string encodable in numeric mode. Empty strings qualify. */
const NUMERIC = /^\d*$/;

/** Matches a string encodable in alphanumeric mode. Empty strings qualify. */
const ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]*$/;

/** True when every character fits numeric mode. */
export function isNumeric(text: string): boolean {
	return NUMERIC.test(text);
}

/** True when every character fits alphanumeric mode. */
export function isAlphanumeric(text: string): boolean {
	return ALPHANUMERIC.test(text);
}

/** Encodes digits, three at a time into 10 bits. */
export function numericSegment(digits: string): Segment {
	const bits = new BitBuffer();

	for (let i = 0; i < digits.length; i += 3) {
		const chunk = digits.slice(i, i + 3);
		// A trailing pair takes 7 bits and a single digit 4, not 10.
		bits.push(Number.parseInt(chunk, 10), chunk.length * 3 + 1);
	}

	return { mode: Mode.NUMERIC, length: digits.length, bits };
}

/** Encodes alphanumeric characters, two at a time into 11 bits. */
export function alphanumericSegment(text: string): Segment {
	const bits = new BitBuffer();

	for (let i = 0; i + 1 < text.length; i += 2) {
		const high = ALPHANUMERIC_CHARSET.indexOf(text[i] as string);
		const low = ALPHANUMERIC_CHARSET.indexOf(text[i + 1] as string);
		bits.push(high * 45 + low, 11);
	}

	// An odd trailing character takes 6 bits on its own.
	if (text.length % 2 === 1) {
		bits.push(ALPHANUMERIC_CHARSET.indexOf(text[text.length - 1] as string), 6);
	}

	return { mode: Mode.ALPHANUMERIC, length: text.length, bits };
}

/** Encodes raw bytes, eight bits each. */
export function byteSegment(data: Uint8Array): Segment {
	const bits = new BitBuffer();
	for (const byte of data) bits.push(byte, 8);
	return { mode: Mode.BYTE, length: data.length, bits };
}

/** Picks the most compact single-mode encoding for a string. */
export function makeSegment(text: string): Segment {
	if (isNumeric(text)) return numericSegment(text);
	if (isAlphanumeric(text)) return alphanumericSegment(text);
	return byteSegment(new TextEncoder().encode(text));
}

/** Total bits a segment occupies at a given version, including its headers. */
export function segmentBitLength(segment: Segment, version: number): number {
	const countBits = CHAR_COUNT_BITS[segment.mode][versionGroup(version)];
	return 4 + countBits + segment.bits.length;
}

/** Total bits a list of segments occupies at a given version. */
export function totalBitLength(segments: Segment[], version: number): number {
	return segments.reduce((sum, segment) => sum + segmentBitLength(segment, version), 0);
}

/** Serializes a segment with its mode and character count indicators. */
export function writeSegment(segment: Segment, version: number, out: BitBuffer): void {
	out.push(MODE_BITS[segment.mode], 4);
	out.push(segment.length, CHAR_COUNT_BITS[segment.mode][versionGroup(version)]);
	out.append(segment.bits);
}

/**
 * Modes considered by the segmentation search, widest first.
 *
 * The order fixes which mode wins when two cost the same, and every character
 * is encodable in the first, so a run always has at least one candidate.
 */
const MODE_ORDER = [Mode.BYTE, Mode.ALPHANUMERIC, Mode.NUMERIC] as const;

/**
 * Costs are tracked in sixths of a bit, so that the fractional per-character
 * costs of numeric (10/3 bits) and alphanumeric (11/2 bits) stay exact
 * integers and the comparisons below never drift.
 */
const SIXTHS = 6;

/** UTF-8 length of a code point, which is its cost in byte mode. */
function utf8Length(codePoint: number): number {
	if (codePoint < 0x80) return 1;
	if (codePoint < 0x800) return 2;
	if (codePoint < 0x10000) return 3;
	return 4;
}

/**
 * Whether one code point is a digit, without allocating a string.
 *
 * @returns True for U+0030 to U+0039.
 */
function isNumericCodePoint(codePoint: number): boolean {
	return codePoint >= 0x30 && codePoint <= 0x39;
}

/**
 * Whether one code point is in the alphanumeric charset.
 *
 * @returns True when the character appears in {@link ALPHANUMERIC_CHARSET}.
 */
function isAlphanumericCodePoint(codePoint: number): boolean {
	return ALPHANUMERIC_CHARSET.indexOf(String.fromCodePoint(codePoint)) !== -1;
}

/**
 * Chooses the cheapest mode for every character by dynamic programming.
 *
 * At each character the running cost of ending in each of the three modes is
 * carried forward, either by continuing that mode or by paying for a mode
 * switch (a new 4-bit indicator plus a character count field). Ending cost is
 * rounded up to a whole bit at each switch, because a segment boundary always
 * falls on a bit boundary.
 */
function chooseModes(codePoints: number[], version: number): Mode[] {
	const headCosts = MODE_ORDER.map((mode) => (4 + CHAR_COUNT_BITS[mode][versionGroup(version)]) * SIXTHS);

	// charModes[i][j] is the mode character i should use, given that the run
	// ending at character i finishes in mode j.
	const charModes: (Mode | null)[][] = [];
	let previous = [...headCosts];

	for (const codePoint of codePoints) {
		const modes: (Mode | null)[] = [null, null, null];
		const costs = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

		// Staying in a mode: byte always possible, the others only for
		// characters that mode can represent.
		costs[0] = (previous[0] as number) + utf8Length(codePoint) * 8 * SIXTHS;
		modes[0] = Mode.BYTE;

		if (isAlphanumericCodePoint(codePoint)) {
			// 11 bits per 2 characters = 5.5 bits = 33 sixths.
			costs[1] = (previous[1] as number) + 33;
			modes[1] = Mode.ALPHANUMERIC;
		}

		if (isNumericCodePoint(codePoint)) {
			// 10 bits per 3 characters = 10/3 bits = 20 sixths.
			costs[2] = (previous[2] as number) + 20;
			modes[2] = Mode.NUMERIC;
		}

		// Switching into mode j from mode k, if k can encode this character.
		for (let j = 0; j < MODE_ORDER.length; j++) {
			for (let k = 0; k < MODE_ORDER.length; k++) {
				const switched = Math.ceil((costs[k] as number) / SIXTHS) * SIXTHS + (headCosts[j] as number);
				if (modes[k] !== null && (modes[j] === null || switched < (costs[j] as number))) {
					costs[j] = switched;
					modes[j] = MODE_ORDER[k] as Mode;
				}
			}
		}

		charModes.push(modes);
		previous = costs;
	}

	// Pick the cheapest terminal mode, then walk the choices backwards.
	let end = 0;
	for (let i = 1; i < MODE_ORDER.length; i++) {
		if ((previous[i] as number) < (previous[end] as number)) end = i;
	}

	let current = MODE_ORDER[end] as Mode;
	const result: Mode[] = [];
	for (let i = codePoints.length - 1; i >= 0; i--) {
		const index = MODE_ORDER.indexOf(current as (typeof MODE_ORDER)[number]);
		current = (charModes[i] as (Mode | null)[])[index] as Mode;
		result.push(current);
	}

	return result.reverse();
}

/**
 * Encodes text as the cheapest possible sequence of segments for a version.
 *
 * A URL like `otpauth://totp/...?secret=ABC123&period=30` is part lowercase
 * (byte only) and part uppercase-and-digits (alphanumeric), and splitting it
 * can save a whole symbol version compared with encoding it all as bytes.
 */
export function makeSegments(text: string, version: number): Segment[] {
	if (text.length === 0) return [];

	const codePoints = [...text].map((character) => character.codePointAt(0) as number);
	const modes = chooseModes(codePoints, version);

	const segments: Segment[] = [];
	let start = 0;

	for (let i = 1; i <= codePoints.length; i++) {
		if (i < codePoints.length && modes[i] === modes[start]) continue;

		const run = codePoints
			.slice(start, i)
			.map((codePoint) => String.fromCodePoint(codePoint))
			.join("");

		switch (modes[start]) {
			case Mode.NUMERIC:
				segments.push(numericSegment(run));
				break;
			case Mode.ALPHANUMERIC:
				segments.push(alphanumericSegment(run));
				break;
			default:
				segments.push(byteSegment(new TextEncoder().encode(run)));
				break;
		}

		start = i;
	}

	return segments;
}
