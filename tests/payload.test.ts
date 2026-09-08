import { describe, expect, test } from "bun:test";
import { QRCode, ErrorCorrectionLevel } from "../src/qrcode.ts";
import {
	bip21,
	bitcoin,
	email,
	epc,
	erc20,
	ethereum,
	event,
	geo,
	gs1,
	hotp,
	latin2,
	lightning,
	mecard,
	monero,
	pix,
	sms,
	solana,
	tel,
	text,
	totp,
	upi,
	upn,
	url,
	vcard,
	wifi,
} from "../src/payload.ts";

/**
 * Parses a `WIFI:` payload back into its fields, honouring the backslash
 * escaping and the quoting used for hex-looking values. Round-tripping through
 * this is what proves the escaping in {@link wifi} is real rather than
 * cosmetic.
 */
function parseWifi(payload: string): Record<string, string> {
	expect(payload.startsWith("WIFI:")).toBe(true);
	expect(payload.endsWith(";;")).toBe(true);

	const body = payload.slice("WIFI:".length, -1);
	const fields: Record<string, string> = {};
	let i = 0;

	while (i < body.length) {
		const colon = body.indexOf(":", i);
		if (colon === -1) break;
		const key = body.slice(i, colon);
		i = colon + 1;

		let value = "";
		let quoted = false;
		if (body[i] === '"') {
			quoted = true;
			i++;
		}
		while (i < body.length) {
			const char = body[i];
			if (char === "\\") {
				value += body[i + 1];
				i += 2;
				continue;
			}
			if (quoted && char === '"') {
				quoted = false;
				i++;
				continue;
			}
			if (!quoted && char === ";") break;
			value += char;
			i++;
		}

		fields[key] = value;
		i++;
	}

	return fields;
}

/** Reverses the RFC 6350 text escaping shared by vCard and iCalendar. */
function unescapeIcal(value: string): string {
	return value.replace(/\\([\\;,n])/g, (_, char: string) => (char === "n" ? "\n" : char));
}

/** Splits a vCard or VEVENT block into its lines. */
function lines(block: string): string[] {
	expect(block.includes("\r\n")).toBe(true);
	return block.split("\r\n");
}

describe("url", () => {
	test("uppercases the scheme and host but never the path", () => {
		expect(url("https://rabbit-company.com/")).toBe("HTTPS://RABBIT-COMPANY.COM/");
		expect(url("https://example.com/Path/To/Page")).toBe("HTTPS://EXAMPLE.COM/Path/To/Page");
		expect(url("https://example.com/p?q=Aa&r=Bb#Frag")).toBe("HTTPS://EXAMPLE.COM/p?q=Aa&r=Bb#Frag");
	});

	test("folding preserves the URL's meaning", () => {
		for (const original of [
			"https://rabbit-company.com/",
			"https://example.com/a/b?x=1&y=Zz#top",
			"http://example.com:8080/path",
			"https://user:PaSs@example.com/x",
		]) {
			const folded = new URL(url(original));
			const plain = new URL(original);
			expect(folded.protocol).toBe(plain.protocol);
			expect(folded.hostname).toBe(plain.hostname);
			expect(folded.port).toBe(plain.port);
			expect(folded.pathname).toBe(plain.pathname);
			expect(folded.search).toBe(plain.search);
			expect(folded.hash).toBe(plain.hash);
		}
	});

	test("leaves case-sensitive authority parts alone", () => {
		// Userinfo is case-sensitive, so only the host after "@" may fold.
		expect(url("https://User:PaSs@example.com/")).toBe("HTTPS://User:PaSs@EXAMPLE.COM/");
		// A port is digits either way, but must survive the split.
		expect(url("http://example.com:8080/x")).toBe("HTTP://EXAMPLE.COM:8080/x");
	});

	test("leaves punycode and IP literals alone", () => {
		expect(url("https://xn--bcher-kva.example/")).toBe("HTTPS://xn--bcher-kva.example/");
		expect(url("http://[::1]:80/x")).toBe("HTTP://[::1]:80/x");
		expect(url("http://192.168.1.1/x")).toBe("HTTP://192.168.1.1/x");
	});

	test("does not add a trailing slash the caller omitted", () => {
		expect(url("https://rabbit-company.com")).toBe("HTTPS://RABBIT-COMPANY.COM");
	});

	test("compact false returns the input untouched", () => {
		expect(url("https://rabbit-company.com/x", { compact: false })).toBe("https://rabbit-company.com/x");
	});

	test("accepts a URL object and rejects a non-URL", () => {
		expect(url(new URL("https://example.com/a"))).toBe("HTTPS://EXAMPLE.COM/a");
		expect(() => url("not a url")).toThrow(TypeError);
		expect(() => url("/relative/path")).toThrow(TypeError);
	});

	test("folding produces a symbol no larger than the original", () => {
		const options = { errorCorrectionLevel: ErrorCorrectionLevel.MEDIUM, boostEcc: false } as const;
		for (const site of ["https://rabbit-company.com/", "https://example.com/", "https://a.co/", "https://shop.example.com/products/12345"]) {
			const folded = QRCode.encode(url(site), options).version;
			const plain = QRCode.encode(site, options).version;
			expect(folded).toBeLessThanOrEqual(plain);
		}
	});
});

describe("text", () => {
	test("passes the value through unchanged", () => {
		expect(text("Table 12")).toBe("Table 12");
		expect(text("a;b,c:d\\e")).toBe("a;b,c:d\\e");
	});
});

describe("email", () => {
	test("builds a mailto with encoded headers", () => {
		const payload = email({ to: "info@rabbit-company.com", subject: "Hello & welcome" });
		expect(payload).toBe("mailto:info@rabbit-company.com?subject=Hello%20%26%20welcome");
	});

	test("round-trips subject and body through a URL parse", () => {
		const subject = "50% off & more?";
		const body = "Line one\nLine two & three";
		const parsed = new URL(email({ to: "a@b.com", subject, body }));
		expect(parsed.protocol).toBe("mailto:");
		expect(parsed.searchParams.get("subject")).toBe(subject);
		expect(parsed.searchParams.get("body")).toBe(body);
	});

	test("supports several recipients and cc/bcc", () => {
		const payload = email({ to: ["a@b.com", "c@d.com"], cc: "e@f.com", bcc: ["g@h.com"] });
		expect(payload.startsWith("mailto:a@b.com,c@d.com?")).toBe(true);
		expect(payload).toContain("cc=e@f.com");
		expect(payload).toContain("bcc=g@h.com");
	});

	test("rejects a missing or malformed recipient", () => {
		expect(() => email({ to: [] })).toThrow(RangeError);
		expect(() => email({ to: "" })).toThrow(RangeError);
		expect(() => email({ to: "not-an-address" })).toThrow(RangeError);
	});
});

describe("tel and sms", () => {
	test("strips visual separators but keeps the plus", () => {
		expect(tel("+386 (1) 234-5678")).toBe("tel:+38612345678");
		expect(tel("01 234 5678")).toBe("tel:012345678");
	});

	test("rejects a number with no digits", () => {
		expect(() => tel("")).toThrow(RangeError);
		expect(() => tel("abc")).toThrow(RangeError);
	});

	test("defaults to the SMSTO convention", () => {
		expect(sms({ to: "+38612345678", message: "Table for two" })).toBe("SMSTO:+38612345678:Table for two");
		expect(sms({ to: "+38612345678" })).toBe("SMSTO:+38612345678");
	});

	test("a colon in the message survives, since parsers take the rest verbatim", () => {
		const payload = sms({ to: "+38612345678", message: "Meet at 10:30" });
		const rest = payload.slice("SMSTO:+38612345678:".length);
		expect(rest).toBe("Meet at 10:30");
	});

	test("the rfc format is a parseable sms URI", () => {
		const payload = sms({ to: "+38612345678", message: "Hi & bye", format: "rfc" });
		const parsed = new URL(payload);
		expect(parsed.protocol).toBe("sms:");
		expect(parsed.searchParams.get("body")).toBe("Hi & bye");
	});
});

describe("geo", () => {
	test("builds a geo URI with optional parts", () => {
		expect(geo(46.0569, 14.5058)).toBe("geo:46.0569,14.5058");
		expect(geo(46.0569, 14.5058, { altitude: 295 })).toBe("geo:46.0569,14.5058,295");
		expect(geo(46, 14, { uncertainty: 10 })).toBe("geo:46,14;u=10");
	});

	test("rejects coordinates outside their range", () => {
		expect(() => geo(91, 0)).toThrow(RangeError);
		expect(() => geo(-91, 0)).toThrow(RangeError);
		expect(() => geo(0, 181)).toThrow(RangeError);
		expect(() => geo(Number.NaN, 0)).toThrow(RangeError);
		expect(() => geo(0, 0, { uncertainty: -1 })).toThrow(RangeError);
	});
});

describe("wifi", () => {
	test("round-trips a password full of delimiters", () => {
		const ssid = "Cafe; Guest";
		const password = 'a:b;c,d\\e"f';
		const fields = parseWifi(wifi({ ssid, password }));
		expect(fields.S).toBe(ssid);
		expect(fields.P).toBe(password);
		expect(fields.T).toBe("WPA");
	});

	test("escapes rather than truncating at a semicolon", () => {
		// The bug this format invites: an unescaped ";" ends the field early.
		const payload = wifi({ ssid: "Net", password: "pass;word" });
		expect(payload).toContain("P:pass\\;word");
		expect(parseWifi(payload).P).toBe("pass;word");
	});

	test("quotes a hex-looking SSID so it is read as text", () => {
		const payload = wifi({ ssid: "ABCD1234", password: "12345678" });
		expect(payload).toContain('S:"ABCD1234"');
		expect(parseWifi(payload).S).toBe("ABCD1234");
	});

	test("an odd-length hex-looking value needs no quoting", () => {
		expect(wifi({ ssid: "ABC", password: "12345678" })).toContain("S:ABC;");
	});

	test("open networks carry no password", () => {
		expect(wifi({ ssid: "Airport Free" })).toBe("WIFI:T:nopass;S:Airport Free;;");
		expect(() => wifi({ ssid: "x", security: "nopass", password: "secret12" })).toThrow(RangeError);
	});

	test("marks a hidden network", () => {
		expect(wifi({ ssid: "Net", password: "12345678", hidden: true })).toContain(";H:true;");
	});

	test("validates key lengths", () => {
		expect(() => wifi({ ssid: "", password: "12345678" })).toThrow(RangeError);
		expect(() => wifi({ ssid: "x".repeat(33), password: "12345678" })).toThrow(RangeError);
		expect(() => wifi({ ssid: "Net", password: "short" })).toThrow(/8 to 63/);
		expect(() => wifi({ ssid: "Net", security: "WPA" })).toThrow(RangeError);
		expect(() => wifi({ ssid: "Net", security: "WEP", password: "abc" })).toThrow(RangeError);
		expect(wifi({ ssid: "Net", security: "WEP", password: "abcde" })).toContain("P:abcde");
	});

	test("a real hex key stays bare, so it is read as hex", () => {
		// 10 and 26 hex digits are WEP key lengths. Quoting them would force an
		// ASCII reading and join with the wrong key.
		expect(wifi({ ssid: "Net", security: "WEP", password: "0123456789" })).toContain("P:0123456789;");
		expect(wifi({ ssid: "Net", security: "WEP", password: "a".repeat(26) })).toContain(`P:${"a".repeat(26)};`);
		// 64 hex digits is a raw WPA pre-shared key, which is also valid input.
		const psk = "0123456789abcdef".repeat(4);
		expect(wifi({ ssid: "Net", password: psk })).toContain(`P:${psk};`);
	});

	test("a passphrase that merely looks like hex is quoted", () => {
		// 8 hex digits is not a key length, so the user meant the literal text.
		const payload = wifi({ ssid: "Net", password: "12345678" });
		expect(payload).toContain('P:"12345678"');
		expect(parseWifi(payload).P).toBe("12345678");
	});
});

describe("totp and hotp", () => {
	test("builds a Key Uri Format URI that parses", () => {
		const uri = totp({ issuer: "Rabbit Company", account: "alice@example.com", secret: "JBSWY3DPEHPK3PXP" });
		const parsed = new URL(uri);
		expect(parsed.protocol).toBe("otpauth:");
		expect(parsed.host).toBe("totp");
		expect(decodeURIComponent(parsed.pathname)).toBe("/Rabbit Company:alice@example.com");
		expect(parsed.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
		expect(parsed.searchParams.get("issuer")).toBe("Rabbit Company");
	});

	test("normalizes a padded, lowercase, spaced secret", () => {
		const uri = totp({ account: "a", secret: "jbsw y3dp ehpk 3pxp===" });
		expect(new URL(uri).searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
	});

	test("encodes raw key bytes as unpadded base32", () => {
		// RFC 4648 test vectors.
		const encode = (s: string) => new URL(totp({ account: "a", secret: new TextEncoder().encode(s) })).searchParams.get("secret");
		expect(encode("f")).toBe("MY");
		expect(encode("fo")).toBe("MZXQ");
		expect(encode("foo")).toBe("MZXW6");
		expect(encode("foob")).toBe("MZXW6YQ");
		expect(encode("fooba")).toBe("MZXW6YTB");
		expect(encode("foobar")).toBe("MZXW6YTBOI");
	});

	test("rejects a secret that is not base32", () => {
		expect(() => totp({ account: "a", secret: "not-base32!" })).toThrow(/base32/);
		expect(() => totp({ account: "a", secret: "ABC189" })).toThrow(/base32/);
		expect(() => totp({ account: "a", secret: "" })).toThrow(RangeError);
		expect(() => totp({ account: "a", secret: new Uint8Array(0) })).toThrow(RangeError);
	});

	test("omits parameters that match the specification defaults", () => {
		const uri = totp({ account: "a", secret: "JBSWY3DP", algorithm: "SHA1", digits: 6, period: 30 });
		expect(uri).not.toContain("algorithm=");
		expect(uri).not.toContain("digits=");
		expect(uri).not.toContain("period=");
	});

	test("keeps parameters that differ from the defaults", () => {
		const uri = totp({ account: "a", secret: "JBSWY3DP", algorithm: "SHA256", digits: 8, period: 60 });
		expect(uri).toContain("algorithm=SHA256");
		expect(uri).toContain("digits=8");
		expect(uri).toContain("period=60");
	});

	test("validates account, digits and period", () => {
		expect(() => totp({ account: " ", secret: "JBSWY3DP" })).toThrow(RangeError);
		expect(() => totp({ account: "a", secret: "JBSWY3DP", digits: 7 })).toThrow(RangeError);
		expect(() => totp({ account: "a", secret: "JBSWY3DP", period: 0 })).toThrow(RangeError);
	});

	test("hotp requires a counter", () => {
		const uri = hotp({ account: "a", secret: "JBSWY3DP", counter: 5 });
		expect(new URL(uri).host).toBe("hotp");
		expect(new URL(uri).searchParams.get("counter")).toBe("5");
		expect(() => hotp({ account: "a", secret: "JBSWY3DP", counter: -1 })).toThrow(RangeError);
		expect(() => hotp({ account: "a", secret: "JBSWY3DP", counter: 1.5 })).toThrow(RangeError);
	});
});

describe("mecard", () => {
	test("builds a card in the documented shape", () => {
		expect(mecard({ firstName: "Alice", lastName: "Smith", phones: ["+38612345678"] })).toBe("MECARD:N:Smith,Alice;TEL:+38612345678;;");
	});

	test("escapes the delimiters that would split a field", () => {
		const payload = mecard({ organization: "Smith, Jones; Ltd" });
		expect(payload).toContain("ORG:Smith\\, Jones\\; Ltd");
		const value = /ORG:((?:\\.|[^;])*)/.exec(payload)?.[1] ?? "";
		expect(value.replace(/\\(.)/g, "$1")).toBe("Smith, Jones; Ltd");
	});

	test("carries every supported field", () => {
		const payload = mecard({
			firstName: "Alice",
			lastName: "Smith",
			phones: ["1", "2"],
			emails: ["a@b.com"],
			organization: "Acme",
			urls: ["https://example.com"],
			note: "hi",
			birthday: new Date("1990-05-04T00:00:00Z"),
			address: { street: "Main 1", city: "Ljubljana", country: "SI" },
		});
		expect(payload).toContain("TEL:1;TEL:2");
		expect(payload).toContain("EMAIL:a@b.com");
		expect(payload).toContain("BDAY:19900504");
		expect(payload).toContain("ADR:Main 1 Ljubljana SI");
	});

	test("rejects an empty card", () => {
		expect(() => mecard({})).toThrow(RangeError);
	});
});

describe("vcard", () => {
	test("builds a valid 4.0 card with CRLF endings", () => {
		const block = lines(vcard({ firstName: "Alice", lastName: "Smith", organization: "Rabbit Company" }));
		expect(block[0]).toBe("BEGIN:VCARD");
		expect(block[1]).toBe("VERSION:4.0");
		expect(block).toContain("N:Smith;Alice;;;");
		expect(block).toContain("FN:Alice Smith");
		expect(block).toContain("ORG:Rabbit Company");
		expect(block[block.length - 1]).toBe("END:VCARD");
	});

	test("escapes and round-trips text containing delimiters", () => {
		const note = "Line one\nSemi; comma, slash\\";
		const block = lines(vcard({ firstName: "A", note }));
		const line = block.find((entry) => entry.startsWith("NOTE:")) ?? "";
		expect(line).not.toContain("\n");
		expect(unescapeIcal(line.slice("NOTE:".length))).toBe(note);
	});

	test("uses an explicit display name when given", () => {
		expect(lines(vcard({ firstName: "A", lastName: "B", displayName: "Dr B" }))).toContain("FN:Dr B");
	});

	test("lays out the address in RFC 6350 field order", () => {
		const block = lines(vcard({ firstName: "A", address: { street: "Main 1", city: "Ljubljana", postalCode: "1000", country: "SI" } }));
		expect(block).toContain("ADR:;;Main 1;Ljubljana;;1000;SI");
	});

	test("rejects an empty card", () => {
		expect(() => vcard({})).toThrow(RangeError);
	});
});

describe("event", () => {
	test("builds a VEVENT with UTC timestamps", () => {
		const block = lines(
			event({
				title: "Launch",
				start: new Date("2026-09-08T10:00:00Z"),
				end: new Date("2026-09-08T11:00:00Z"),
				location: "Ljubljana",
			}),
		);
		expect(block[0]).toBe("BEGIN:VEVENT");
		expect(block).toContain("SUMMARY:Launch");
		expect(block).toContain("DTSTART:20260908T100000Z");
		expect(block).toContain("DTEND:20260908T110000Z");
		expect(block).toContain("LOCATION:Ljubljana");
		expect(block[block.length - 1]).toBe("END:VEVENT");
	});

	test("all-day events carry dates without a time", () => {
		const block = lines(event({ title: "Holiday", start: new Date("2026-12-25T00:00:00Z"), allDay: true }));
		expect(block).toContain("DTSTART;VALUE=DATE:20261225");
	});

	test("escapes the description", () => {
		const description = "First; second, third\nfourth";
		const block = lines(event({ title: "x", start: new Date("2026-01-01T00:00:00Z"), description }));
		const line = block.find((entry) => entry.startsWith("DESCRIPTION:")) ?? "";
		expect(unescapeIcal(line.slice("DESCRIPTION:".length))).toBe(description);
	});

	test("rejects bad input", () => {
		const start = new Date("2026-01-02T00:00:00Z");
		expect(() => event({ title: "", start })).toThrow(RangeError);
		expect(() => event({ title: "x", start: new Date("nonsense") })).toThrow(RangeError);
		expect(() => event({ title: "x", start, end: new Date("2026-01-01T00:00:00Z") })).toThrow(RangeError);
	});
});

describe("payloads encode", () => {
	test("every builder produces something the encoder accepts", () => {
		const payloads = [
			url("https://rabbit-company.com/"),
			text("Table 12"),
			email({ to: "info@rabbit-company.com", subject: "Hi" }),
			tel("+38612345678"),
			sms({ to: "+38612345678", message: "Hi" }),
			geo(46.0569, 14.5058),
			wifi({ ssid: "Guest", password: "hunter2!" }),
			totp({ issuer: "Rabbit Company", account: "alice@example.com", secret: "JBSWY3DPEHPK3PXP" }),
			hotp({ account: "alice", secret: "JBSWY3DPEHPK3PXP", counter: 0 }),
			mecard({ firstName: "Alice", lastName: "Smith", phones: ["+38612345678"] }),
			vcard({ firstName: "Alice", lastName: "Smith", emails: ["a@b.com"] }),
			event({ title: "Launch", start: new Date("2026-09-08T10:00:00Z") }),
		];

		for (const payload of payloads) {
			const qr = QRCode.encode(payload);
			expect(qr.version).toBeGreaterThanOrEqual(1);
			expect(qr.toSVG().startsWith("<svg")).toBe(true);
		}
	});
});

describe("crypto", () => {
	const BECH32 = "bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d";
	const LEGACY = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
	const ETH = "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7";
	const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
	const SOL = "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH";
	const XMR = `4${"A".repeat(94)}`;

	test("one satoshi never becomes exponent notation", () => {
		// String(0.00000001) is "1e-8", which no wallet parses.
		expect(bitcoin(BECH32, { amount: 0.00000001 })).toContain("amount=0.00000001");
		expect(bitcoin(BECH32, { amount: 0.0000001 })).toContain("amount=0.0000001");
		expect(bitcoin(BECH32, { amount: 0.001 })).toContain("amount=0.001");
	});

	test("amounts keep no trailing zeros and survive whole numbers", () => {
		expect(bitcoin(BECH32, { amount: 1 })).toContain("amount=1");
		expect(bitcoin(BECH32, { amount: 0.5 })).toContain("amount=0.5");
		expect(bitcoin(BECH32, { amount: 21000000 })).toContain("amount=21000000");
		// A string passes through with the caller's exact digits.
		expect(bitcoin(BECH32, { amount: "0.10000000" })).toContain("amount=0.10000000");
	});

	test("bech32 folds to uppercase and base58 does not", () => {
		expect(bitcoin(BECH32)).toBe(`BITCOIN:${BECH32.toUpperCase()}`);
		// Base58 encodes data in its case, so folding it would corrupt it.
		expect(bitcoin(LEGACY)).toBe(`bitcoin:${LEGACY}`);
		expect(bitcoin(BECH32, { compact: false })).toBe(`bitcoin:${BECH32}`);
	});

	test("folding a bech32 request produces a smaller symbol", () => {
		const options = { errorCorrectionLevel: ErrorCorrectionLevel.MEDIUM, boostEcc: false } as const;
		const folded = QRCode.encode(bitcoin(BECH32, { amount: 0.001 }), options).version;
		const plain = QRCode.encode(bitcoin(BECH32, { amount: 0.001, compact: false }), options).version;
		expect(folded).toBeLessThan(plain);
	});

	test("bitcoin carries labels and rejects bad addresses", () => {
		const uri = bitcoin(LEGACY, { amount: 0.01, label: "Rabbit Company", message: "Order #7" });
		const parsed = new URL(uri);
		expect(parsed.searchParams.get("label")).toBe("Rabbit Company");
		expect(parsed.searchParams.get("message")).toBe("Order #7");
		expect(() => bitcoin("not-an-address")).toThrow(RangeError);
		// b, i, o and 1 are outside the bech32 data charset.
		expect(() => bitcoin("bc1bio0000000000")).toThrow(RangeError);
	});

	test("bip21 serves the other currencies that share the scheme", () => {
		expect(bip21("litecoin", "ltc1qxyz", { amount: 1.5 })).toBe("litecoin:ltc1qxyz?amount=1.5");
		expect(bip21("dogecoin", "DAddress", { label: "Tip" })).toBe("dogecoin:DAddress?label=Tip");
		expect(bip21("bitcoin", "addr", { params: { "req-thing": "x" } })).toContain("req-thing=x");
		expect(() => bip21("not a scheme", "addr")).toThrow(RangeError);
		expect(() => bip21("bitcoin", "")).toThrow(RangeError);
	});

	test("ethereum preserves the EIP-55 checksum case", () => {
		// The mixed case IS the checksum, so it must never be folded.
		expect(ethereum({ to: ETH })).toBe(`ethereum:${ETH}`);
		expect(ethereum({ to: ETH, chainId: 137 })).toBe(`ethereum:${ETH}@137`);
	});

	test("ethereum values are exact at wei scale", () => {
		const uri = ethereum({ to: ETH, value: 10n ** 18n });
		expect(uri).toContain("value=1000000000000000000");
		expect(ethereum({ to: ETH, value: "250000000000000000" })).toContain("value=250000000000000000");
		expect(() => ethereum({ to: ETH, value: "1.5" })).toThrow(RangeError);
		expect(() => ethereum({ to: ETH, value: -1n })).toThrow(RangeError);
		expect(() => ethereum({ to: "0xnope" })).toThrow(RangeError);
		expect(() => ethereum({ to: ETH, chainId: 0 })).toThrow(RangeError);
	});

	test("erc20 targets the contract and carries the recipient as an argument", () => {
		const uri = erc20({ contract: USDC, to: ETH, amount: 1_000_000n });
		expect(uri).toBe(`ethereum:${USDC}/transfer?address=${ETH}&uint256=1000000`);
		expect(erc20({ contract: USDC, to: ETH, amount: "5", chainId: 137 })).toContain(`${USDC}@137/transfer`);
	});

	test("solana pay carries token, reference and memo", () => {
		expect(solana(SOL, { amount: 0.5 })).toBe(`solana:${SOL}?amount=0.5`);
		const uri = solana(SOL, { amount: 1, splToken: SOL, reference: SOL, label: "Shop", memo: "note" });
		const parsed = new URL(uri);
		expect(parsed.searchParams.get("spl-token")).toBe(SOL);
		expect(parsed.searchParams.get("reference")).toBe(SOL);
		expect(parsed.searchParams.get("memo")).toBe("note");
		expect(() => solana("0x1234")).toThrow(RangeError);
		expect(() => solana(SOL, { splToken: "nope" })).toThrow(RangeError);
	});

	test("monero uses its own parameter names", () => {
		const uri = monero(XMR, { amount: 0.25, recipientName: "Rabbit Company", paymentId: "abc" });
		expect(uri).toContain("tx_amount=0.25");
		expect(uri).toContain("recipient_name=Rabbit%20Company");
		expect(uri).toContain("tx_payment_id=abc");
		expect(() => monero("nope")).toThrow(RangeError);
	});

	test("lightning invoices are uppercased for the symbol", () => {
		const invoice = "lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq";
		expect(lightning(invoice)).toBe(`LIGHTNING:${invoice.toUpperCase()}`);
		expect(lightning(`lightning:${invoice}`)).toBe(`LIGHTNING:${invoice.toUpperCase()}`);
		expect(lightning(invoice, { compact: false })).toBe(`lightning:${invoice}`);
		expect(() => lightning("not-an-invoice")).toThrow(RangeError);
	});

	test("every crypto payload encodes", () => {
		for (const payload of [
			bitcoin(BECH32, { amount: 0.001, label: "Shop" }),
			bip21("litecoin", "ltc1qxyz", { amount: 2 }),
			ethereum({ to: ETH, value: 10n ** 18n }),
			erc20({ contract: USDC, to: ETH, amount: 1_000_000n }),
			solana(SOL, { amount: 0.5 }),
			monero(XMR, { amount: 0.25 }),
		]) {
			expect(QRCode.encode(payload).version).toBeGreaterThanOrEqual(1);
		}
	});
});

/**
 * Parses an EMV tag-length-value payload back into a map, so a PIX payload is
 * checked for structural validity rather than string equality. A wrong length
 * byte makes the walk desynchronize and the parse fail.
 */
function parseTlv(payload: string): Record<string, string> {
	const fields: Record<string, string> = {};
	let i = 0;

	while (i < payload.length) {
		const id = payload.slice(i, i + 2);
		const length = Number(payload.slice(i + 2, i + 4));
		expect(Number.isInteger(length)).toBe(true);
		const value = payload.slice(i + 4, i + 4 + length);
		expect(value).toHaveLength(length);
		fields[id] = value;
		i += 4 + length;
	}

	expect(i).toBe(payload.length);
	return fields;
}

/** Recomputes CRC-16/CCITT-FALSE, to check a payload independently. */
function crcOf(text: string): string {
	let crc = 0xffff;
	for (let i = 0; i < text.length; i++) {
		crc ^= text.charCodeAt(i) << 8;
		for (let b = 0; b < 8; b++) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
	}
	return crc.toString(16).toUpperCase().padStart(4, "0");
}

describe("upi", () => {
	test("builds a upi://pay request", () => {
		const payload = upi({ payeeAddress: "merchant@bank", payeeName: "Rabbit Company", amount: 250.5 });
		const parsed = new URL(payload);
		expect(parsed.protocol).toBe("upi:");
		expect(parsed.host).toBe("pay");
		expect(parsed.searchParams.get("pa")).toBe("merchant@bank");
		expect(parsed.searchParams.get("pn")).toBe("Rabbit Company");
		expect(parsed.searchParams.get("am")).toBe("250.5");
		expect(parsed.searchParams.get("cu")).toBe("INR");
	});

	test("paise amounts stay plain decimal", () => {
		expect(new URL(upi({ payeeAddress: "a@b", payeeName: "n", amount: 0.01 })).searchParams.get("am")).toBe("0.01");
		expect(new URL(upi({ payeeAddress: "a@b", payeeName: "n", amount: 100 })).searchParams.get("am")).toBe("100");
	});

	test("carries the reconciliation fields", () => {
		const parsed = new URL(upi({ payeeAddress: "a@b", payeeName: "n", reference: "REF1", transactionId: "T1", merchantCode: "5411", note: "Order 7" }));
		expect(parsed.searchParams.get("tr")).toBe("REF1");
		expect(parsed.searchParams.get("tid")).toBe("T1");
		expect(parsed.searchParams.get("mc")).toBe("5411");
		expect(parsed.searchParams.get("tn")).toBe("Order 7");
	});

	test("rejects a malformed address, code or note", () => {
		expect(() => upi({ payeeAddress: "no-at-sign", payeeName: "n" })).toThrow(RangeError);
		expect(() => upi({ payeeAddress: "a@b c", payeeName: "n" })).toThrow(RangeError);
		expect(() => upi({ payeeAddress: "@bank", payeeName: "n" })).toThrow(RangeError);
		expect(() => upi({ payeeAddress: "merchant@bank", payeeName: "" })).toThrow(RangeError);
		expect(() => upi({ payeeAddress: "merchant@bank", payeeName: "n", merchantCode: "54" })).toThrow(RangeError);
		expect(() => upi({ payeeAddress: "merchant@bank", payeeName: "n", note: "x".repeat(51) })).toThrow(/at most 50/);
	});
});

describe("epc", () => {
	const IBAN = "DE89370400440532013000";

	test("builds the fixed line block", () => {
		const block = epc({ name: "Rabbit Company", iban: IBAN, amount: 12.5, remittance: "Invoice 2026-014" }).split("\n");
		expect(block[0]).toBe("BCD");
		expect(block[1]).toBe("002");
		expect(block[2]).toBe("1");
		expect(block[3]).toBe("SCT");
		expect(block[4]).toBe("");
		expect(block[5]).toBe("Rabbit Company");
		expect(block[6]).toBe(IBAN);
		expect(block[7]).toBe("EUR12.5");
		expect(block[10]).toBe("Invoice 2026-014");
	});

	test("verifies the IBAN mod-97 checksum", () => {
		// One digit changed from the valid IBAN above.
		expect(() => epc({ name: "n", iban: "DE89370400440532013001" })).toThrow(/mod-97/);
		expect(() => epc({ name: "n", iban: "not-an-iban" })).toThrow(RangeError);
		// Spaces and lower case are accepted and normalized away.
		expect(epc({ name: "n", iban: "de89 3704 0044 0532 0130 00" })).toContain(IBAN);
	});

	test("version 001 requires a BIC and 002 does not", () => {
		expect(() => epc({ name: "n", iban: IBAN, version: "001" })).toThrow(/requires a bic/);
		expect(epc({ name: "n", iban: IBAN, version: "001", bic: "COBADEFFXXX" }).split("\n")[4]).toBe("COBADEFFXXX");
		expect(() => epc({ name: "n", iban: IBAN, bic: "nope" })).toThrow(RangeError);
	});

	test("reference and remittance are mutually exclusive", () => {
		expect(() => epc({ name: "n", iban: IBAN, reference: "R", remittance: "M" })).toThrow(/not both/);
	});

	test("drops trailing empty lines", () => {
		expect(epc({ name: "n", iban: IBAN }).split("\n")).toHaveLength(7);
	});

	test("enforces the 331 byte cap", () => {
		// Every field at its maximum overruns the cap, which the trailing-line
		// trim alone cannot rescue.
		const full = {
			name: "n".repeat(70),
			iban: IBAN,
			bic: "COBADEFFXXX",
			amount: 999999999.99,
			purpose: "GDDS",
			remittance: "x".repeat(140),
			information: "y".repeat(70),
		} as const;
		expect(() => epc(full)).toThrow(/at most 331/);
		// Shortening the remittance brings it back inside.
		expect(() => epc({ ...full, remittance: "x".repeat(40) })).not.toThrow();
	});

	test("validates the amount range and purpose", () => {
		expect(() => epc({ name: "n", iban: IBAN, amount: 0.001 })).toThrow(/0.01/);
		expect(() => epc({ name: "n", iban: IBAN, amount: 1e10 })).toThrow(RangeError);
		expect(() => epc({ name: "n", iban: IBAN, purpose: "TOOLONG" })).toThrow(RangeError);
	});
});

describe("gs1", () => {
	test("builds a digital link and pads the GTIN to 14 digits", () => {
		expect(gs1({ gtin: "09521234543213" })).toBe("https://id.gs1.org/01/09521234543213");
		// A GTIN-13 pads to 14, which leaves the check digit valid.
		expect(gs1({ gtin: "9521234543213" })).toBe("https://id.gs1.org/01/09521234543213");
		expect(gs1({ gtin: "12345670" })).toBe("https://id.gs1.org/01/00000012345670");
	});

	test("verifies the mod-10 check digit", () => {
		expect(() => gs1({ gtin: "09521234543214" })).toThrow(/check digit/);
		expect(() => gs1({ gtin: "123" })).toThrow(/8, 12, 13 or 14/);
		expect(() => gs1({ gtin: "0952123454321a" })).toThrow(RangeError);
	});

	test("orders the qualifiers as the standard requires", () => {
		const link = gs1({ gtin: "09521234543213", serial: "S1", lot: "LOT-A", cpv: "V2" });
		expect(link).toBe("https://id.gs1.org/01/09521234543213/22/V2/10/LOT-A/21/S1");
	});

	test("data attributes become query parameters", () => {
		const link = gs1({ gtin: "09521234543213", lot: "L1", attributes: { "17": "251231", "3103": "000195" } });
		expect(link).toBe("https://id.gs1.org/01/09521234543213/10/L1?17=251231&3103=000195");
		expect(() => gs1({ gtin: "09521234543213", attributes: { abc: "1" } })).toThrow(RangeError);
	});

	test("honors a custom resolver and escapes path segments", () => {
		expect(gs1({ gtin: "09521234543213", domain: "https://example.com/" })).toBe("https://example.com/01/09521234543213");
		expect(gs1({ gtin: "09521234543213", lot: "A/B" })).toContain("/10/A%2FB");
	});
});

describe("pix", () => {
	const base = { key: "alice@example.com", name: "Rabbit Company", city: "SAO PAULO" };

	test("the CRC matches an independent computation", () => {
		const payload = pix({ ...base, amount: 10.5 });
		const body = payload.slice(0, -4);
		expect(body.endsWith("6304")).toBe(true);
		expect(payload.slice(-4)).toBe(crcOf(body));
	});

	test("the CRC implementation matches the published check value", () => {
		// CRC-16/CCITT-FALSE is defined to give 0x29B1 for "123456789".
		expect(crcOf("123456789")).toBe("29B1");
	});

	test("every length byte is consistent, so the TLV walk completes", () => {
		const payload = pix({ ...base, amount: 10.5, reference: "ORDER7" });
		const fields = parseTlv(payload.slice(0, -8));
		expect(fields["00"]).toBe("01");
		expect(fields["52"]).toBe("0000");
		expect(fields["53"]).toBe("986");
		expect(fields["54"]).toBe("10.5");
		expect(fields["58"]).toBe("BR");
		expect(fields["59"]).toBe("Rabbit Company");
		expect(fields["60"]).toBe("SAO PAULO");

		// The merchant account and additional data fields nest another TLV run.
		const account = parseTlv(fields["26"] as string);
		expect(account["00"]).toBe("br.gov.bcb.pix");
		expect(account["01"]).toBe("alice@example.com");
		expect(parseTlv(fields["62"] as string)["05"]).toBe("ORDER7");
	});

	test("defaults the reference to the standard placeholder", () => {
		const fields = parseTlv(pix(base).slice(0, -8));
		expect(parseTlv(fields["62"] as string)["05"]).toBe("***");
		expect(fields["54"]).toBeUndefined();
	});

	test("marks a single use code and a category", () => {
		const fields = parseTlv(pix({ ...base, oneTime: true, merchantCategoryCode: "5411" }).slice(0, -8));
		expect(fields["01"]).toBe("12");
		expect(fields["52"]).toBe("5411");
	});

	test("rejects fields the format cannot hold", () => {
		expect(() => pix({ ...base, name: "x".repeat(26) })).toThrow(/at most 25/);
		expect(() => pix({ ...base, city: "x".repeat(16) })).toThrow(/at most 15/);
		expect(() => pix({ ...base, reference: "x".repeat(26) })).toThrow(/at most 25/);
		expect(() => pix({ ...base, merchantCategoryCode: "12" })).toThrow(RangeError);
		expect(() => pix({ ...base, name: "" })).toThrow(RangeError);
	});
});

describe("regional payloads encode", () => {
	test("each one produces something the encoder accepts", () => {
		for (const payload of [
			upi({ payeeAddress: "merchant@bank", payeeName: "Rabbit Company", amount: 250.5 }),
			epc({ name: "Rabbit Company", iban: "DE89370400440532013000", amount: 12.5, remittance: "Invoice 14" }),
			gs1({ gtin: "09521234543213", lot: "LOT-A", serial: "S1" }),
			pix({ key: "alice@example.com", name: "Rabbit Company", city: "SAO PAULO", amount: 10.5 }),
		]) {
			expect(QRCode.encode(payload).version).toBeGreaterThanOrEqual(1);
		}
	});
});

describe("latin2", () => {
	test("matches the platform ISO-8859-2 decoder", () => {
		const decoder = new TextDecoder("iso-8859-2");
		for (const sample of ["Racun", "Žiga Zajc", "čČšŠžŽ", "1000 Ljubljana", "Đorđe Ćirić"]) {
			expect(decoder.decode(latin2(sample))).toBe(sample);
		}
	});

	test("Slovenian characters take one byte, unlike UTF-8", () => {
		expect(latin2("č")).toEqual(new Uint8Array([0xe8]));
		expect(latin2("š")).toEqual(new Uint8Array([0xb9]));
		expect(latin2("ž")).toEqual(new Uint8Array([0xbe]));
		// The same characters need two bytes each as UTF-8.
		expect(new TextEncoder().encode("čšž")).toHaveLength(6);
		expect(latin2("čšž")).toHaveLength(3);
	});

	test("refuses a character Latin-2 cannot hold", () => {
		expect(() => latin2("Ryō")).toThrow(/ISO-8859-2/);
		expect(() => latin2("→")).toThrow(RangeError);
		expect(() => latin2("emoji 😀")).toThrow(RangeError);
	});
});

describe("upn", () => {
	const IBAN = "SI56263300012039086";
	const base = { recipientIban: IBAN, recipientName: "Rabbit Company" };

	test("builds nineteen fields plus a control sum", () => {
		const payload = upn({ ...base, recipientCity: "1000 Ljubljana", amount: 12.5, purpose: "Racun 2026-014" });
		const lines = payload.split("\n");
		// Nineteen fields plus the control sum, and nothing after it.
		expect(lines).toHaveLength(20);
		expect(payload.endsWith("\n")).toBe(false);
		expect(lines[0]).toBe("UPNQR");
		expect(lines[8]).toBe("00000001250");
		expect(lines[11]).toBe("OTHR");
		expect(lines[12]).toBe("Racun 2026-014");
		expect(lines[14]).toBe(IBAN);
		expect(lines[15]).toBe("SI99");
		expect(lines[16]).toBe("Rabbit Company");
		expect(lines[18]).toBe("1000 Ljubljana");
	});

	test("the control sum counts the field characters and their newlines", () => {
		const payload = upn({ ...base, amount: 12.5 });
		const fields = payload.split("\n");
		const stated = fields[19] as string;
		const body = fields.slice(0, 19).reduce((sum, field) => sum + field.length + 1, 0);
		expect(Number(stated)).toBe(body);
		expect(stated).toMatch(/^\d{3}$/);
	});

	test("reproduces the layout of a real Slovenian utility bill", () => {
		// Field order, the cents amount, the date format and the control sum
		// definition all confirmed against a QR that a Slovenian bank accepts.
		// The values here are synthetic. Only the shape is taken from life.
		const payload = upn({
			payerName: "NOVAK MARIJA",
			payerStreet: "PRIMER 1 A",
			payerCity: "1000 LJUBLJANA",
			amount: 15.99,
			purposeCode: "OTLC",
			purpose: "Placilo racuna za 1234567",
			dueDate: new Date(2026, 8, 21),
			recipientIban: "SI56040010048886437",
			recipientReference: "SI121234567890123",
			recipientName: "PRIMER PODJETJE, d.d.",
			recipientStreet: "Primerova ulica 15",
			recipientCity: "1000 Ljubljana",
		});

		const fields = payload.split("\n");
		expect(fields).toHaveLength(20);
		expect(fields[0]).toBe("UPNQR");
		// Fields 2 to 5 stay empty on a biller-issued order.
		expect(fields.slice(1, 5)).toEqual(["", "", "", ""]);
		expect(fields[5]).toBe("NOVAK MARIJA");
		expect(fields[8]).toBe("00000001599");
		// The payment date is left to the payer, and urgency is unset.
		expect(fields[9]).toBe("");
		expect(fields[10]).toBe("");
		expect(fields[11]).toBe("OTLC");
		expect(fields[13]).toBe("21.09.2026");
		expect(fields[16]).toBe("PRIMER PODJETJE, d.d.");
		expect(fields[19]).toMatch(/^\d{3}$/);
		expect(payload.endsWith("\n")).toBe(false);
	});

	test("the amount is cents padded to eleven digits", () => {
		const cents = (amount: number | string | undefined) => upn({ ...base, amount }).split("\n")[8];
		expect(cents(12.5)).toBe("00000001250");
		expect(cents(0.01)).toBe("00000000001");
		expect(cents(1)).toBe("00000000100");
		expect(cents(1234.56)).toBe("00000123456");
		// Omitting the amount lets the payer type it.
		expect(cents(undefined)).toBe("00000000000");
	});

	test("verifies the recipient IBAN", () => {
		expect(() => upn({ ...base, recipientIban: "SI56263300012039087" })).toThrow(/mod-97/);
		expect(upn({ ...base, recipientIban: "SI56 2633 0001 2039 086" })).toContain(IBAN);
	});

	test("validates the reference and purpose code", () => {
		expect(upn({ ...base, recipientReference: "SI121234567890123" })).toContain("SI121234567890123");
		expect(upn({ ...base, recipientReference: "RF18539007547034" })).toContain("RF18539007547034");
		expect(() => upn({ ...base, recipientReference: "12345" })).toThrow(RangeError);
		expect(() => upn({ ...base, purposeCode: "OTH" })).toThrow(RangeError);
		expect(upn({ ...base, purposeCode: "gdsv" }).split("\n")[11]).toBe("GDSV");
	});

	test("carries the payer block and the urgent flag", () => {
		const lines = upn({
			...base,
			payerName: "Žiga Zajc",
			payerStreet: "Slovenska cesta 1",
			payerCity: "1000 Ljubljana",
			urgent: true,
			dueDate: new Date(2026, 8, 30),
		}).split("\n");
		expect(lines[5]).toBe("Žiga Zajc");
		expect(lines[6]).toBe("Slovenska cesta 1");
		expect(lines[7]).toBe("1000 Ljubljana");
		expect(lines[10]).toBe("X");
		expect(lines[13]).toBe("30.09.2026");
	});

	test("enforces the field lengths", () => {
		expect(() => upn({ ...base, recipientName: "x".repeat(34) })).toThrow(/at most 33/);
		expect(() => upn({ ...base, purpose: "x".repeat(43) })).toThrow(/at most 42/);
		expect(() => upn({ ...base, payerIban: "x".repeat(20) })).toThrow(/at most 19/);
		expect(() => upn({ ...base, recipientName: "" })).toThrow(RangeError);
	});

	test("encodes through encodeBinary with Slovenian characters intact", () => {
		const payload = upn({ ...base, recipientName: "Žiga d.o.o.", purpose: "Račun za košarico", amount: 9.99 });
		const qr = QRCode.encodeBinary(latin2(payload));
		expect(qr.version).toBeGreaterThanOrEqual(1);
		// Latin-2 is one byte per character, so the byte count equals the length.
		expect(latin2(payload)).toHaveLength(payload.length);
	});
});
