/**
 * Reed-Solomon error correction over GF(2^8).
 *
 * QR codes use the field defined by the primitive polynomial
 * x^8 + x^4 + x^3 + x^2 + 1 (0x11D), with generator element 2.
 */

/** The field's reducing polynomial, without its x^8 term. */
const PRIMITIVE = 0x11d;

/** Antilog table: EXP[i] is 2^i in the field. */
const EXP = new Uint8Array(256);

/** Log table: LOG[EXP[i]] is i. LOG[0] is undefined and never read. */
const LOG = new Uint8Array(256);

// Building the tables once at module load turns every later multiply into two
// lookups and an add, instead of a bitwise carry-less multiplication.
{
	let value = 1;
	for (let i = 0; i < 255; i++) {
		EXP[i] = value;
		LOG[value] = i;
		value <<= 1;
		if (value & 0x100) value ^= PRIMITIVE;
	}
}

/** Multiplies two field elements. */
export function multiply(a: number, b: number): number {
	if (a === 0 || b === 0) return 0;
	return EXP[((LOG[a] as number) + (LOG[b] as number)) % 255] as number;
}

/**
 * Builds the generator polynomial of the given degree.
 *
 * It is the product of (x - 2^i) for i in [0, degree), whose roots are exactly
 * what the decoder checks the received codewords against.
 */
function generatorPolynomial(degree: number): Uint8Array {
	const result = new Uint8Array(degree);
	// Coefficients are stored highest-power-first, with the leading 1 implied.
	result[degree - 1] = 1;

	let root = 1;
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < degree; j++) {
			result[j] = multiply(result[j] as number, root);
			if (j + 1 < degree) result[j] = (result[j] as number) ^ (result[j + 1] as number);
		}
		root = multiply(root, 2);
	}

	return result;
}

/** Cache of generator polynomials, which depend only on the degree. */
const generators = new Map<number, Uint8Array>();

/**
 * Returns the generator polynomial of a degree, computing it once.
 *
 * @param degree - Number of error correction codewords per block.
 * @returns The cached polynomial. Shared, so callers must not modify it.
 */
function generator(degree: number): Uint8Array {
	let polynomial = generators.get(degree);
	if (polynomial === undefined) {
		polynomial = generatorPolynomial(degree);
		generators.set(degree, polynomial);
	}
	return polynomial;
}

/**
 * Computes the error correction codewords for one block.
 *
 * This is the remainder of the data polynomial divided by the generator
 * polynomial, computed with a shift register.
 */
export function encode(data: Uint8Array, eccLength: number): Uint8Array {
	const divisor = generator(eccLength);
	const result = new Uint8Array(eccLength);

	for (const byte of data) {
		const factor = byte ^ (result[0] as number);
		result.copyWithin(0, 1);
		result[eccLength - 1] = 0;
		for (let i = 0; i < eccLength; i++) {
			result[i] = (result[i] as number) ^ multiply(divisor[i] as number, factor);
		}
	}

	return result;
}
