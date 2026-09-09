/**
 * Reed-Solomon error correction over GF(2^8).
 *
 * QR codes use the field defined by the primitive polynomial
 * x^8 + x^4 + x^3 + x^2 + 1 (0x11D), with generator element 2.
 */
/** Multiplies two field elements. */
export declare function multiply(a: number, b: number): number;
/**
 * Computes the error correction codewords for one block.
 *
 * This is the remainder of the data polynomial divided by the generator
 * polynomial, computed with a shift register.
 */
export declare function encode(data: Uint8Array, eccLength: number): Uint8Array;
