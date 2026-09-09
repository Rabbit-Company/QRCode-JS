import { ErrorCorrectionLevel } from "./types.ts";
/** Smallest QR symbol version. */
export declare const MIN_VERSION = 1;
/** Largest QR symbol version. */
export declare const MAX_VERSION = 40;
/** Ordering used to index the specification tables below. */
export declare const ECC_ORDER: readonly [ErrorCorrectionLevel.LOW, ErrorCorrectionLevel.MEDIUM, ErrorCorrectionLevel.QUARTILE, ErrorCorrectionLevel.HIGH];
/** Two-bit field written into the format information area, per level. */
export declare const ECC_FORMAT_BITS: Record<ErrorCorrectionLevel, number>;
/** Index of a level within {@link ECC_ORDER}. */
export declare function eccIndex(level: ErrorCorrectionLevel): number;
/**
 * Error correction codewords per block, indexed by [eccIndex][version].
 *
 * Index 0 of each row is unused padding so that versions index directly.
 * Table 13-22 of ISO/IEC 18004.
 */
export declare const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[];
/**
 * Number of error correction blocks, indexed by [eccIndex][version].
 *
 * Table 13-22 of ISO/IEC 18004.
 */
export declare const ECC_BLOCKS: readonly (readonly number[])[];
/** Bit length of the character count indicator, by mode and version group. */
export declare const CHAR_COUNT_BITS: {
    readonly numeric: readonly [10, 12, 14];
    readonly alphanumeric: readonly [9, 11, 13];
    readonly byte: readonly [8, 16, 16];
};
/** Four-bit mode indicator written before each segment. */
export declare const MODE_BITS: {
    readonly numeric: 1;
    readonly alphanumeric: 2;
    readonly byte: 4;
};
/** Characters encodable in alphanumeric mode, in their code-point order. */
export declare const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
/**
 * Total number of data and error correction modules for a version, before the
 * function patterns are removed.
 *
 * Derived rather than tabulated: the symbol is (17 + 4v) square, minus the
 * finder patterns and format areas (a fixed 64 + 128v + 16v² relationship),
 * minus the alignment patterns and the version information blocks.
 */
export declare function rawDataModules(version: number): number;
/** Number of data codewords available for a version and level. */
export declare function dataCodewords(version: number, level: ErrorCorrectionLevel): number;
/**
 * Center coordinates of the alignment patterns for a version.
 *
 * The first and last are fixed at 6 and size-7. The rest are spaced as evenly
 * as possible between them, rounded up to an even step.
 */
export declare function alignmentPositions(version: number): number[];
/** Version group index used to size the character count indicator. */
export declare function versionGroup(version: number): 0 | 1 | 2;
