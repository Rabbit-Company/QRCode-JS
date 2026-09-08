import { describe, expect, test } from "bun:test";
import { QRCode, ErrorCorrectionLevel, Mode, toDataURL, toSVG, toText } from "../src/qrcode.ts";
import { ECC_BLOCKS, ECC_CODEWORDS_PER_BLOCK, alignmentPositions, dataCodewords, rawDataModules } from "../src/constants.ts";
import { isAlphanumeric, isNumeric, makeSegments } from "../src/segment.ts";
import { encode as reedSolomon, multiply } from "../src/reed-solomon.ts";

/** SHA-256 (truncated) of the flattened module grid, for golden comparisons. */
function fingerprint(qr: QRCode): string {
	const bits = qr
		.toArray()
		.map((row) => row.map((module) => (module ? "1" : "0")).join(""))
		.join("");
	return new Bun.CryptoHasher("sha256").update(bits).digest("hex").slice(0, 32);
}

describe("specification tables", () => {
	test("every version and level yields a positive data capacity", () => {
		for (let version = 1; version <= 40; version++) {
			for (const level of Object.values(ErrorCorrectionLevel)) {
				expect(dataCodewords(version, level)).toBeGreaterThan(0);
			}
		}
	});

	test("capacity decreases as error correction strengthens", () => {
		for (let version = 1; version <= 40; version++) {
			const low = dataCodewords(version, ErrorCorrectionLevel.LOW);
			const medium = dataCodewords(version, ErrorCorrectionLevel.MEDIUM);
			const quartile = dataCodewords(version, ErrorCorrectionLevel.QUARTILE);
			const high = dataCodewords(version, ErrorCorrectionLevel.HIGH);
			expect(low).toBeGreaterThan(medium);
			expect(medium).toBeGreaterThan(quartile);
			expect(quartile).toBeGreaterThan(high);
		}
	});

	test("capacity grows with version", () => {
		for (const level of Object.values(ErrorCorrectionLevel)) {
			for (let version = 2; version <= 40; version++) {
				expect(dataCodewords(version, level)).toBeGreaterThan(dataCodewords(version - 1, level));
			}
		}
	});

	test("data and error correction codewords account for every raw codeword", () => {
		for (let version = 1; version <= 40; version++) {
			for (let ecc = 0; ecc < 4; ecc++) {
				const level = Object.values(ErrorCorrectionLevel)[ecc] as ErrorCorrectionLevel;
				const blocks = ECC_BLOCKS[ecc]?.[version] as number;
				const perBlock = ECC_CODEWORDS_PER_BLOCK[ecc]?.[version] as number;
				expect(dataCodewords(version, level) + blocks * perBlock).toBe(Math.floor(rawDataModules(version) / 8));
			}
		}
	});

	test("known total data codewords match the specification", () => {
		// Spot checks from ISO/IEC 18004 Table 7. These are codeword counts,
		// which are larger than the widely quoted byte capacities because the
		// mode and character count indicators come out of the same budget.
		expect(dataCodewords(1, ErrorCorrectionLevel.LOW)).toBe(19);
		expect(dataCodewords(1, ErrorCorrectionLevel.HIGH)).toBe(9);
		expect(dataCodewords(10, ErrorCorrectionLevel.MEDIUM)).toBe(216);
		expect(dataCodewords(40, ErrorCorrectionLevel.LOW)).toBe(2956);
		expect(dataCodewords(40, ErrorCorrectionLevel.HIGH)).toBe(1276);
	});

	test("byte capacities match the published figures", () => {
		const byteCapacity = (version: number, level: ErrorCorrectionLevel) => Math.floor((dataCodewords(version, level) * 8 - 4 - (version <= 9 ? 8 : 16)) / 8);

		expect(byteCapacity(1, ErrorCorrectionLevel.LOW)).toBe(17);
		expect(byteCapacity(10, ErrorCorrectionLevel.MEDIUM)).toBe(213);
		expect(byteCapacity(40, ErrorCorrectionLevel.LOW)).toBe(2953);
		expect(byteCapacity(40, ErrorCorrectionLevel.HIGH)).toBe(1273);
	});

	test("alignment positions follow the specification", () => {
		expect(alignmentPositions(1)).toEqual([]);
		expect(alignmentPositions(2)).toEqual([6, 18]);
		expect(alignmentPositions(7)).toEqual([6, 22, 38]);
		// Version 32 is the documented exception to the spacing formula.
		expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
		expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
	});

	test("alignment positions stay inside the symbol and are ordered", () => {
		for (let version = 2; version <= 40; version++) {
			const positions = alignmentPositions(version);
			const size = version * 4 + 17;
			expect(positions[0]).toBe(6);
			expect(positions[positions.length - 1]).toBe(size - 7);
			for (let i = 1; i < positions.length; i++) {
				expect(positions[i] as number).toBeGreaterThan(positions[i - 1] as number);
			}
		}
	});
});

describe("Galois field", () => {
	test("multiplication has an identity and an annihilator", () => {
		for (let a = 0; a < 256; a++) {
			expect(multiply(a, 1)).toBe(a);
			expect(multiply(a, 0)).toBe(0);
		}
	});

	test("multiplication is commutative", () => {
		for (let a = 0; a < 256; a += 7) {
			for (let b = 0; b < 256; b += 11) {
				expect(multiply(a, b)).toBe(multiply(b, a));
			}
		}
	});

	test("produces the expected number of parity codewords", () => {
		expect(reedSolomon(new Uint8Array([1, 2, 3]), 10)).toHaveLength(10);
		expect(reedSolomon(new Uint8Array(100), 30)).toHaveLength(30);
	});

	test("parity of an all-zero block is all zero", () => {
		expect([...reedSolomon(new Uint8Array(16), 10)]).toEqual(new Array(10).fill(0));
	});
});

describe("segmentation", () => {
	test("classifies characters correctly", () => {
		expect(isNumeric("12345")).toBe(true);
		expect(isNumeric("12a45")).toBe(false);
		expect(isAlphanumeric("HELLO WORLD")).toBe(true);
		expect(isAlphanumeric("hello")).toBe(false);
		expect(isAlphanumeric("$%*+-./: ")).toBe(true);
	});

	test("uses a single segment for uniform input", () => {
		expect(makeSegments("12345", 1).map((s) => s.mode)).toEqual([Mode.NUMERIC]);
		expect(makeSegments("HELLO", 1).map((s) => s.mode)).toEqual([Mode.ALPHANUMERIC]);
		expect(makeSegments("hello", 1).map((s) => s.mode)).toEqual([Mode.BYTE]);
	});

	test("splits mixed content when that is cheaper", () => {
		// A long digit run inside byte text is worth its own numeric segment.
		const modes = makeSegments(`a${"1".repeat(40)}b`, 5).map((s) => s.mode);
		expect(modes).toContain(Mode.NUMERIC);
		expect(modes).toContain(Mode.BYTE);
	});

	test("does not split when switching costs more than it saves", () => {
		expect(makeSegments("a1b", 1)).toHaveLength(1);
	});

	test("optimal segmentation yields a smaller symbol than byte mode alone", () => {
		// Lowercase text with a long digit run: the digits are worth their own
		// numeric segment even after paying for two mode switches.
		const url = "https://rabbit-company.com/invoice/2024001234567890";
		const options = { errorCorrectionLevel: ErrorCorrectionLevel.QUARTILE, boostEcc: false } as const;

		const optimal = QRCode.encode(url, options);
		const asBytes = QRCode.encodeBinary(new TextEncoder().encode(url), options);

		expect(optimal.version).toBe(4);
		expect(asBytes.version).toBe(5);
	});
});

describe("encoding", () => {
	test("size follows the version", () => {
		for (let version = 1; version <= 40; version++) {
			const qr = QRCode.encode("x", { minVersion: version, maxVersion: version });
			expect(qr.size).toBe(version * 4 + 17);
			expect(qr.version).toBe(version);
		}
	});

	test("golden vectors are stable", () => {
		const vectors: [string, string, ErrorCorrectionLevel, number, number, number, string][] = [
			["hello-q0", "HELLO WORLD", ErrorCorrectionLevel.QUARTILE, 0, 1, 21, "98ee3af8dfb46e027fa18006e4cb5079"],
			["num-m3", "0123456789", ErrorCorrectionLevel.MEDIUM, 3, 1, 21, "58b264232c4c39c56401e28c62b13570"],
			["url-l2", "https://rabbit-company.com", ErrorCorrectionLevel.LOW, 2, 2, 25, "bc0ac37292e0c5bc64905bbad4574b28"],
			[
				"otpauth-m5",
				"otpauth://totp/Bloggy:ziga?secret=HQCX4H2PNBW423B6XVGRZLOIYELZEKEN&issuer=Bloggy",
				ErrorCorrectionLevel.MEDIUM,
				5,
				5,
				37,
				"9ee2db94d66e7a1f30dba9f9980ad28a",
			],
			["unicode-h1", "Ünïcödé ☃", ErrorCorrectionLevel.HIGH, 1, 3, 29, "e3e61ae6c9ed18f877c81e93132fa8c5"],
		];

		for (const [name, text, level, mask, version, size, hash] of vectors) {
			const qr = QRCode.encode(text, { errorCorrectionLevel: level, mask, boostEcc: false });
			expect(`${name}:v${qr.version}`).toBe(`${name}:v${version}`);
			expect(qr.size).toBe(size);
			expect(`${name}:${fingerprint(qr)}`).toBe(`${name}:${hash}`);
		}
	});

	test("finder patterns sit in three corners", () => {
		const qr = QRCode.encode("test");
		for (const [ox, oy] of [
			[0, 0],
			[qr.size - 7, 0],
			[0, qr.size - 7],
		]) {
			// Outer ring dark, inner ring light, 3x3 core dark.
			expect(qr.getModule((ox as number) + 0, (oy as number) + 0)).toBe(true);
			expect(qr.getModule((ox as number) + 1, (oy as number) + 1)).toBe(false);
			expect(qr.getModule((ox as number) + 3, (oy as number) + 3)).toBe(true);
		}
	});

	test("finder separators are light", () => {
		const qr = QRCode.encode("test");
		// The separator is the one-module light border between a finder and the
		// data region, and it is what makes the finder detectable.
		for (let i = 0; i <= 7; i++) {
			expect(qr.getModule(7, i)).toBe(false);
			expect(qr.getModule(i, 7)).toBe(false);
			expect(qr.getModule(qr.size - 8, i)).toBe(false);
			expect(qr.getModule(i, qr.size - 8)).toBe(false);
		}
	});

	test("timing patterns alternate", () => {
		const qr = QRCode.encode("test");
		for (let i = 8; i < qr.size - 8; i++) {
			expect(qr.getModule(i, 6)).toBe(i % 2 === 0);
			expect(qr.getModule(6, i)).toBe(i % 2 === 0);
		}
	});

	test("the dark module is always set", () => {
		for (const level of Object.values(ErrorCorrectionLevel)) {
			const qr = QRCode.encode("test", { errorCorrectionLevel: level });
			expect(qr.getModule(8, qr.size - 8)).toBe(true);
		}
	});

	test("out-of-range coordinates read as light", () => {
		const qr = QRCode.encode("test");
		expect(qr.getModule(-1, 0)).toBe(false);
		expect(qr.getModule(0, -1)).toBe(false);
		expect(qr.getModule(qr.size, 0)).toBe(false);
		expect(qr.getModule(0, qr.size)).toBe(false);
	});

	test("stronger correction needs the same or a larger symbol", () => {
		const text = "https://rabbit-company.com/some/longer/path?with=query";
		const low = QRCode.encode(text, { errorCorrectionLevel: ErrorCorrectionLevel.LOW, boostEcc: false });
		const high = QRCode.encode(text, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH, boostEcc: false });
		expect(high.version).toBeGreaterThanOrEqual(low.version);
	});

	test("boostEcc raises the level without growing the symbol", () => {
		const boosted = QRCode.encode("hi", { errorCorrectionLevel: ErrorCorrectionLevel.LOW, boostEcc: true });
		const plain = QRCode.encode("hi", { errorCorrectionLevel: ErrorCorrectionLevel.LOW, boostEcc: false });
		expect(boosted.version).toBe(plain.version);
		expect(boosted.errorCorrectionLevel).toBe(ErrorCorrectionLevel.HIGH);
	});

	test("every mask can be forced and is recorded", () => {
		for (let mask = 0; mask < 8; mask++) {
			expect(QRCode.encode("test", { mask }).mask).toBe(mask);
		}
	});

	test("automatic mask selection picks a valid pattern", () => {
		const qr = QRCode.encode("test");
		expect(qr.mask).toBeGreaterThanOrEqual(0);
		expect(qr.mask).toBeLessThanOrEqual(7);
	});

	test("encodes binary data", () => {
		const qr = QRCode.encodeBinary(new Uint8Array([0, 1, 2, 253, 254, 255]));
		expect(qr.version).toBeGreaterThanOrEqual(1);
	});

	test("encodes an empty string", () => {
		expect(QRCode.encode("").version).toBe(1);
	});

	test("fills the largest symbol", () => {
		// Version 40-L holds 2953 bytes.
		expect(QRCode.encode("x".repeat(2953), { errorCorrectionLevel: ErrorCorrectionLevel.LOW, boostEcc: false }).version).toBe(40);
	});

	test("toArray returns an independent copy", () => {
		const qr = QRCode.encode("test");
		const grid = qr.toArray();
		const before = qr.getModule(0, 0);
		(grid[0] as boolean[])[0] = !before;
		expect(qr.getModule(0, 0)).toBe(before);
	});
});

describe("errors", () => {
	test("rejects data that cannot fit", () => {
		expect(() => QRCode.encode("x".repeat(3000), { errorCorrectionLevel: ErrorCorrectionLevel.HIGH })).toThrow(RangeError);
		expect(() => QRCode.encode("x".repeat(100), { maxVersion: 1 })).toThrow(RangeError);
	});

	test("rejects invalid options", () => {
		expect(() => QRCode.encode("x", { mask: 8 })).toThrow(RangeError);
		expect(() => QRCode.encode("x", { mask: -2 })).toThrow(RangeError);
		expect(() => QRCode.encode("x", { minVersion: 0 })).toThrow(RangeError);
		expect(() => QRCode.encode("x", { maxVersion: 41 })).toThrow(RangeError);
		expect(() => QRCode.encode("x", { minVersion: 5, maxVersion: 2 })).toThrow(RangeError);
		expect(() => QRCode.encode("x", { minVersion: 1.5 })).toThrow(RangeError);
	});

	test("rejects invalid render options", () => {
		const qr = QRCode.encode("x");
		expect(() => qr.toSVG({ margin: -1 })).toThrow(RangeError);
		expect(() => qr.toSVG({ scale: 0 })).toThrow(RangeError);
	});
});

/**
 * Payload for the logo tests. A version 1 symbol is too small to host a logo
 * at all, so these need something that encodes to a realistic size.
 */
const LOGO_TEXT = "https://rabbit-company.com";

describe("rendering", () => {
	test("SVG is well formed and sized", () => {
		const qr = QRCode.encode("test");
		const svg = qr.toSVG({ scale: 4, margin: 4 });
		const extent = (qr.size + 8) * 4;
		expect(svg.startsWith("<svg")).toBe(true);
		expect(svg.endsWith("</svg>")).toBe(true);
		expect(svg).toContain(`viewBox="0 0 ${extent} ${extent}"`);
		expect(svg).toContain("<path");
	});

	test("SVG honours colors, size, title and declaration", () => {
		const svg = QRCode.encode("test").toSVG({
			dark: "#123456",
			light: "#abcdef",
			size: 256,
			title: "Scan <me>",
			xmlDeclaration: true,
		});
		expect(svg).toContain('fill="#123456"');
		expect(svg).toContain('fill="#abcdef"');
		expect(svg).toContain('width="256" height="256"');
		expect(svg).toContain("<title>Scan &lt;me&gt;</title>");
		expect(svg.startsWith("<?xml")).toBe(true);
	});

	test("transparent background omits the backing rectangle", () => {
		expect(QRCode.encode("test").toSVG({ light: "transparent" })).not.toContain("<rect");
	});

	test("data URL is a usable image source", () => {
		const url = QRCode.encode("test").toDataURL();
		expect(url.startsWith("data:image/svg+xml,")).toBe(true);
		expect(decodeURIComponent(url.slice("data:image/svg+xml,".length)).startsWith("<svg")).toBe(true);
	});

	test("text output is rectangular and reflects the symbol", () => {
		const qr = QRCode.encode("test");
		const lines = qr.toString({ margin: 2 }).split("\n");
		expect(lines).toHaveLength(Math.ceil((qr.size + 4) / 2));
		for (const line of lines) expect(line).toHaveLength(qr.size + 4);
	});

	test("non-compact text output is one row per module row", () => {
		const qr = QRCode.encode("test");
		expect(qr.toString({ margin: 0, compact: false }).split("\n")).toHaveLength(qr.size);
	});

	test("inverse swaps the drawing", () => {
		const normal = QRCode.encode("test").toString();
		const inverted = QRCode.encode("test").toString({ inverse: true });
		expect(inverted).not.toBe(normal);
	});

	test("logo is drawn and the modules beneath it are left out", () => {
		const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		const logo = { content: "data:image/png;base64,iVBORw0KGgo=" };
		const svg = qr.toSVG({ logo });

		expect(svg).toContain("<image ");
		expect(svg).toContain('href="data:image/png;base64,iVBORw0KGgo="');

		// Every dark module inside the cleared square must be gone from the
		// path, and every one outside it must remain.
		const extent = Math.floor(qr.size * 0.2);
		const origin = (qr.size - extent) / 2;
		const from = Math.floor(origin - 1);
		const to = Math.ceil(origin + extent + 1);

		const grid = qr.toArray();
		let expected = 0;
		for (let y = 0; y < qr.size; y++) {
			for (let x = 0; x < qr.size; x++) {
				const cleared = x >= from && x < to && y >= from && y < to;
				if (grid[y]?.[x] === true && !cleared) expected++;
			}
		}

		const drawn = (svg.match(/M\d/g) ?? []).length;
		expect(drawn).toBe(expected);
		expect(drawn).toBeLessThan((qr.toSVG().match(/M\d/g) ?? []).length);
	});

	test("markup content is nested rather than referenced", () => {
		const svg = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH }).toSVG({
			logo: { content: '<svg viewBox="0 0 2 2"><circle cx="1" cy="1" r="1"/></svg>' },
		});
		expect(svg).not.toContain("<image");
		expect(svg).toContain('shape-rendering="auto"');
		expect(svg).toContain('<circle cx="1" cy="1" r="1"/>');
	});

	test("logo plate follows the background option", () => {
		const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		const content = "data:image/png;base64,iVBORw0KGgo=";
		expect(qr.toSVG({ logo: { content, background: "#ff0000" } })).toContain('fill="#ff0000"');
		// One rect for the symbol background, none for the plate.
		expect((qr.toSVG({ logo: { content, background: "transparent" } }).match(/<rect/g) ?? []).length).toBe(1);
	});

	test("logo travels through the convenience helpers and the data URL", () => {
		const options = { errorCorrectionLevel: ErrorCorrectionLevel.HIGH, logo: { content: "data:image/png;base64,iVBORw0KGgo=" } } as const;
		expect(toSVG(LOGO_TEXT, options)).toContain("<image ");
		expect(decodeURIComponent(toDataURL(LOGO_TEXT, options))).toContain("<image ");
	});

	test("rejects a logo that outruns the error correction", () => {
		// A 25 module level L symbol cannot spare the 49 modules a default
		// logo would hide, because it can correct only 40.
		const weak = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.LOW, boostEcc: false });
		expect(() => weak.toSVG({ logo: { content: "x" } })).toThrow(/error correction level L/);

		const strong = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		expect(() => strong.toSVG({ logo: { content: "x" } })).not.toThrow();
	});

	test("rejects a logo that would cover a finder pattern", () => {
		const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		expect(() => qr.toSVG({ logo: { content: "x", size: qr.size - 4 } })).toThrow(/finder pattern/);
	});

	test("skipChecks allows a logo the checks would refuse", () => {
		const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		const svg = qr.toSVG({ logo: { content: "x", size: qr.size - 4, skipChecks: true } });
		expect(svg).toContain("<image ");
	});

	test("rejects invalid logo options", () => {
		const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
		expect(() => qr.toSVG({ logo: { content: "" } })).toThrow(RangeError);
		expect(() => qr.toSVG({ logo: { content: "x", size: 0 } })).toThrow(RangeError);
		expect(() => qr.toSVG({ logo: { content: "x", size: -1 } })).toThrow(RangeError);
		expect(() => qr.toSVG({ logo: { content: "x", padding: -1 } })).toThrow(RangeError);
		expect(() => qr.toSVG({ logo: { content: "x", size: qr.size + 1, skipChecks: true } })).toThrow(RangeError);
	});

	test("convenience helpers match the class methods", () => {
		// The helpers take one options object covering both encoding and
		// rendering, and hand each half to the matching method.
		const encoding = { errorCorrectionLevel: ErrorCorrectionLevel.MEDIUM, mask: 0, boostEcc: false } as const;
		const svgOptions = { scale: 3, margin: 2 } as const;
		const textOptions = { margin: 1 } as const;
		const qr = QRCode.encode("test", encoding);
		expect(toSVG("test", { ...encoding, ...svgOptions })).toBe(qr.toSVG(svgOptions));
		expect(toDataURL("test", { ...encoding, ...svgOptions })).toBe(qr.toDataURL(svgOptions));
		expect(toText("test", { ...encoding, ...textOptions })).toBe(qr.toString(textOptions));
	});
});

describe("frame", () => {
	const qr = QRCode.encode(LOGO_TEXT, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
	const shaded = { from: "#f9be23", to: "#f2660f" } as const;

	test("the band grows the canvas instead of eating the quiet zone", () => {
		const plain = qr.toSVG({ scale: 4, margin: 4 });
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 3 } });
		const extent = (qr.size + 8) * 4;
		expect(plain).toContain(`viewBox="0 0 ${extent} ${extent}"`);
		// Three modules of band on each side, at four units per module.
		expect(framed).toContain(`viewBox="0 0 ${extent + 24} ${extent + 24}"`);
	});

	test("the light background covers only the symbol and its quiet zone", () => {
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 3, fill: "#333333" } });
		const inner = (qr.size + 8) * 4;
		expect(framed).toContain(`<rect x="12" y="12" width="${inner}" height="${inner}" fill="#ffffff"/>`);
	});

	test("modules shift inside the band", () => {
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 3 } });
		const path = /d="M(\d+) (\d+)/.exec(framed);
		// The first dark module is the finder corner at (0, 0), so margin plus
		// band, times scale.
		expect(path?.[1]).toBe("28");
		expect(path?.[2]).toBe("28");
	});

	test("a single color paints one rectangle and no seams", () => {
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 3, fill: "#112233" } });
		expect(framed).toContain('fill="#112233"');
		expect(framed).not.toContain("<polygon");
	});

	test("a pair of stops paints four mitered panels, lightest at the top", () => {
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 3, fill: shaded } });
		const fills = [...framed.matchAll(/<polygon points="[^"]*" fill="(#[0-9a-f]{6})"\/>/g)].map((m) => m[1] as string);
		expect(fills).toHaveLength(4);
		expect(new Set(fills).size).toBe(4);

		// Panels are emitted clockwise from the top.
		const [top, right, bottom, left] = fills as [string, string, string, string];
		expect(top).toBe("#f9be23");
		expect(bottom).toBe("#f2660f");

		// Green descends from the top stop through the sides to the bottom one.
		const green = (fill: string) => Number.parseInt(fill.slice(3, 5), 16);
		expect(green(top)).toBeGreaterThan(green(left));
		expect(green(left)).toBeGreaterThan(green(right));
		expect(green(right)).toBeGreaterThan(green(bottom));
	});

	test("captions are centered in each band and escaped", () => {
		const framed = qr.toSVG({ scale: 4, margin: 4, frame: { width: 4, title: "Scan & pay", caption: "<BTC>" } });
		const extent = (qr.size + 8) * 4 + 32;
		expect(framed).toContain("Scan &amp; pay");
		expect(framed).toContain("&lt;BTC&gt;");
		expect(framed).toContain(`x="${extent / 2}"`);
		// Top caption sits at half the band, the bottom one a band from the edge.
		expect(framed).toContain('y="8"');
		expect(framed).toContain(`y="${extent - 8}"`);
		expect((framed.match(/<text/g) ?? []).length).toBe(2);
	});

	test("both captions share textColor by default", () => {
		const svg = qr.toSVG({ margin: 4, frame: { width: 4, title: "top", caption: "foot", textColor: "#00ff88" } });
		expect((svg.match(/fill="#00ff88"/g) ?? []).length).toBe(2);
	});

	test("each caption can override the shared color", () => {
		const svg = qr.toSVG({
			margin: 4,
			frame: { width: 4, title: "top", caption: "foot", textColor: "#111111", titleColor: "#ff0000", captionColor: "#0000ff" },
		});
		const texts = [...svg.matchAll(/<text[^>]*fill="([^"]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => [m[2], m[1]]);
		expect(texts).toEqual([
			["top", "#ff0000"],
			["foot", "#0000ff"],
		]);
		// The shared color is fully displaced when both override it.
		expect(svg).not.toContain('fill="#111111"');
	});

	test("one caption can override while the other keeps the shared color", () => {
		const svg = qr.toSVG({ margin: 4, frame: { width: 4, title: "top", caption: "foot", textColor: "#222222", captionColor: "#ffcc00" } });
		const texts = [...svg.matchAll(/<text[^>]*fill="([^"]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => [m[2], m[1]]);
		expect(texts).toEqual([
			["top", "#222222"],
			["foot", "#ffcc00"],
		]);
	});

	test("caption colors are escaped", () => {
		expect(qr.toSVG({ margin: 4, frame: { width: 4, title: "t", titleColor: 'a"b' } })).toContain('fill="a&quot;b"');
	});

	test("captions opt back into anti-aliasing", () => {
		// The root keeps modules crisp, which would leave text and seams jagged.
		expect(qr.toSVG({ frame: { width: 3, title: "x" } })).toContain('shape-rendering="auto"');
	});

	test("the caption size follows the band, and can be overridden", () => {
		expect(qr.toSVG({ scale: 10, margin: 4, frame: { width: 4, title: "x" } })).toContain('font-size="28"');
		expect(qr.toSVG({ scale: 10, margin: 4, frame: { width: 4, title: "x", fontSize: 2 } })).toContain('font-size="20"');
	});

	test("refuses a frame only when there is no quiet zone at all", () => {
		// A dark band flush against the modules erases the symbol's edge, which
		// measurably stops it decoding. One module is enough to prevent that.
		expect(() => qr.toSVG({ margin: 0, frame: { width: 3 } })).toThrow(/quiet zone/);
		expect(() => qr.toSVG({ margin: 1, frame: { width: 3 } })).not.toThrow();
		expect(() => qr.toSVG({ margin: 2, frame: { width: 3 } })).not.toThrow();
	});

	test("a narrow quiet zone still puts the band outside the symbol", () => {
		const framed = qr.toSVG({ scale: 8, margin: 1, frame: { width: 3 } });
		const inner = (qr.size + 2) * 8;
		// Band of three modules at eight units, then the light plate.
		expect(framed).toContain(`<rect x="24" y="24" width="${inner}" height="${inner}"`);
		expect(framed).toContain(`viewBox="0 0 ${inner + 48} ${inner + 48}"`);
	});

	test("rejects invalid frame options", () => {
		expect(() => qr.toSVG({ margin: 4, frame: { width: 0 } })).toThrow(RangeError);
		expect(() => qr.toSVG({ margin: 4, frame: { width: -1 } })).toThrow(RangeError);
		// Named colors cannot be blended arithmetically.
		expect(() => qr.toSVG({ margin: 4, frame: { fill: { from: "red", to: "#000000" } } })).toThrow(/hexadecimal/);
		expect(() => qr.toSVG({ margin: 4, frame: { fill: { from: "#fff", to: "#000" } } })).not.toThrow();
	});

	test("a frame and a logo coexist", () => {
		const svg = qr.toSVG({
			scale: 8,
			margin: 4,
			frame: { width: 3, fill: shaded, title: "Bitcoin", caption: "BTC" },
			logo: { content: "data:image/png;base64,iVBORw0KGgo=", size: 8 },
		});
		expect(svg).toContain("<image ");
		expect((svg.match(/<polygon/g) ?? []).length).toBe(4);
		expect((svg.match(/<text/g) ?? []).length).toBe(2);
	});

	test("the data URL carries the frame too", () => {
		const url = qr.toDataURL({ margin: 4, frame: { width: 3, title: "Scan" } });
		expect(decodeURIComponent(url)).toContain("<text");
	});
});
