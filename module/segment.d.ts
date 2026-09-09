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
export declare class BitBuffer {
    /** One entry per bit, each 0 or 1, in the order they were pushed. */
    private readonly bits;
    /** Number of bits held so far. */
    get length(): number;
    /** Appends the low `count` bits of `value`, most significant first. */
    push(value: number, count: number): void;
    /** Appends every bit of `other`, leaving it unchanged. */
    append(other: BitBuffer): void;
    /** Pads to a byte boundary and returns the bytes. */
    toBytes(): Uint8Array;
}
/** True when every character fits numeric mode. */
export declare function isNumeric(text: string): boolean;
/** True when every character fits alphanumeric mode. */
export declare function isAlphanumeric(text: string): boolean;
/** Encodes digits, three at a time into 10 bits. */
export declare function numericSegment(digits: string): Segment;
/** Encodes alphanumeric characters, two at a time into 11 bits. */
export declare function alphanumericSegment(text: string): Segment;
/** Encodes raw bytes, eight bits each. */
export declare function byteSegment(data: Uint8Array): Segment;
/** Picks the most compact single-mode encoding for a string. */
export declare function makeSegment(text: string): Segment;
/** Total bits a segment occupies at a given version, including its headers. */
export declare function segmentBitLength(segment: Segment, version: number): number;
/** Total bits a list of segments occupies at a given version. */
export declare function totalBitLength(segments: Segment[], version: number): number;
/** Serializes a segment with its mode and character count indicators. */
export declare function writeSegment(segment: Segment, version: number, out: BitBuffer): void;
/**
 * Encodes text as the cheapest possible sequence of segments for a version.
 *
 * A URL like `otpauth://totp/...?secret=ABC123&period=30` is part lowercase
 * (byte only) and part uppercase-and-digits (alphanumeric), and splitting it
 * can save a whole symbol version compared with encoding it all as bytes.
 */
export declare function makeSegments(text: string, version: number): Segment[];
