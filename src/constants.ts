import { ErrorCorrectionLevel } from "./types.ts";

/** Smallest QR symbol version. */
export const MIN_VERSION = 1;

/** Largest QR symbol version. */
export const MAX_VERSION = 40;

/** Ordering used to index the specification tables below. */
export const ECC_ORDER = [ErrorCorrectionLevel.LOW, ErrorCorrectionLevel.MEDIUM, ErrorCorrectionLevel.QUARTILE, ErrorCorrectionLevel.HIGH] as const;

/** Two-bit field written into the format information area, per level. */
export const ECC_FORMAT_BITS: Record<ErrorCorrectionLevel, number> = {
	[ErrorCorrectionLevel.LOW]: 1,
	[ErrorCorrectionLevel.MEDIUM]: 0,
	[ErrorCorrectionLevel.QUARTILE]: 3,
	[ErrorCorrectionLevel.HIGH]: 2,
};

/** Index of a level within {@link ECC_ORDER}. */
export function eccIndex(level: ErrorCorrectionLevel): number {
	return ECC_ORDER.indexOf(level);
}

/**
 * Error correction codewords per block, indexed by [eccIndex][version].
 *
 * Index 0 of each row is unused padding so that versions index directly.
 * Table 13-22 of ISO/IEC 18004.
 */
// prettier-ignore
export const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
	// 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29  30  31  32  33  34  35  36  37  38  39  40
	[  0,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Low
	[  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // Medium
	[  0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Quartile
	[  0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // High
];

/**
 * Number of error correction blocks, indexed by [eccIndex][version].
 *
 * Table 13-22 of ISO/IEC 18004.
 */
// prettier-ignore
export const ECC_BLOCKS: readonly (readonly number[])[] = [
	// 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40
	[  0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25], // Low
	[  0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49], // Medium
	[  0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68], // Quartile
	[  0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81], // High
];

/** Bit length of the character count indicator, by mode and version group. */
export const CHAR_COUNT_BITS = {
	numeric: [10, 12, 14],
	alphanumeric: [9, 11, 13],
	byte: [8, 16, 16],
} as const;

/** Four-bit mode indicator written before each segment. */
export const MODE_BITS = {
	numeric: 0b0001,
	alphanumeric: 0b0010,
	byte: 0b0100,
} as const;

/** Characters encodable in alphanumeric mode, in their code-point order. */
export const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/**
 * Total number of data and error correction modules for a version, before the
 * function patterns are removed.
 *
 * Derived rather than tabulated: the symbol is (17 + 4v) square, minus the
 * finder patterns and format areas (a fixed 64 + 128v + 16v² relationship),
 * minus the alignment patterns and the version information blocks.
 */
export function rawDataModules(version: number): number {
	let result = (16 * version + 128) * version + 64;

	if (version >= 2) {
		// Alignment patterns: n² placed, minus the three that overlap finders,
		// minus the modules shared with the timing patterns.
		const alignCount = Math.floor(version / 7) + 2;
		result -= (25 * alignCount - 10) * alignCount - 55;
		// Two 6x3 version information blocks.
		if (version >= 7) result -= 36;
	}

	return result;
}

/** Number of data codewords available for a version and level. */
export function dataCodewords(version: number, level: ErrorCorrectionLevel): number {
	const ecc = eccIndex(level);
	return Math.floor(rawDataModules(version) / 8) - (ECC_CODEWORDS_PER_BLOCK[ecc]?.[version] ?? 0) * (ECC_BLOCKS[ecc]?.[version] ?? 0);
}

/**
 * Center coordinates of the alignment patterns for a version.
 *
 * The first and last are fixed at 6 and size-7. The rest are spaced as evenly
 * as possible between them, rounded up to an even step.
 */
export function alignmentPositions(version: number): number[] {
	if (version === 1) return [];

	const count = Math.floor(version / 7) + 2;
	const size = version * 4 + 17;
	// Version 32 is the one version whose alignment coordinates the general
	// formula does not reproduce. ISO/IEC 18004 Table E.1 lists a step of 26
	// where the formula would give 28.
	const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;

	const positions = [6];
	for (let pos = size - 7; positions.length < count; pos -= step) {
		positions.splice(1, 0, pos);
	}
	return positions;
}

/** Version group index used to size the character count indicator. */
export function versionGroup(version: number): 0 | 1 | 2 {
	if (version <= 9) return 0;
	if (version <= 26) return 1;
	return 2;
}
