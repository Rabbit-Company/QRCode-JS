# QRCode-JS

A simple and lightweight QR code generator implemented in TypeScript.

This library encodes text or binary data into QR code symbols and renders them as SVG, data URLs or terminal output. It implements ISO/IEC 18004 in full: all 40 versions, all four error correction levels, all eight mask patterns, and optimal mixed-mode segmentation.

## Features

- All 40 symbol versions and all four error correction levels (L, M, Q, H)
- Numeric, alphanumeric and byte (UTF-8) encoding modes
- Optimal mixed-mode segmentation, so a URL with digits in it fits in a smaller symbol
- Automatic mask selection using the specification's penalty rules
- Automatic error correction boosting when the chosen symbol has room to spare
- SVG, SVG data URL and terminal output
- Optional center logo and captioned frame, with checks that refuse either if it would break scanning
- Builders for the standard payload formats: URL, Wi-Fi, TOTP, email, contacts, crypto and regional payments
- Zero dependencies
- Fully typed with TypeScript
- Works in the browser, Bun, Node.js and Deno

## Usage

### 1. Download library

```bash
npm i --save @rabbit-company/qrcode
```

### 2. Import library

```js
import { QRCode, ErrorCorrectionLevel, toSVG, toDataURL, toText } from "@rabbit-company/qrcode";
```

### 3. Generate a QR code

```js
/*

  Parameters:
  1. text (String) - The text to encode
  2. options (Object) <optional>
     - errorCorrectionLevel (String) <"M"> - "L", "M", "Q" or "H"
     - minVersion (Number) <1> - Smallest symbol version to consider
     - maxVersion (Number) <40> - Largest symbol version to consider
     - mask (Number) <-1> - Mask pattern 0-7, or -1 to choose automatically
     - boostEcc (Boolean) <true> - Raise the correction level if it is free

*/

// Encode with the default settings
const qr = QRCode.encode("https://rabbit-company.com");

console.log(qr.version); // 2
console.log(qr.size); // 25
console.log(qr.errorCorrectionLevel); // "M"
console.log(qr.mask); // 2

// Encode with the highest error correction
const robust = QRCode.encode("https://rabbit-company.com", {
	errorCorrectionLevel: ErrorCorrectionLevel.HIGH,
});

// Encode raw bytes instead of text
const binary = QRCode.encodeBinary(new Uint8Array([1, 2, 3, 4]));
```

### 4. Render as SVG

```js
/*

  Parameters:
  1. options (Object) <optional>
     - margin (Number) <4> - Quiet zone width in modules
     - scale (Number) <1> - Size of one module in SVG user units
     - dark (String) <"#000000"> - Color of the dark modules
     - light (String) <"#ffffff"> - Background color, or "transparent"
     - size (Number|String) - Value for the width/height attributes
     - title (String) - Accessible label, rendered as <title>
     - xmlDeclaration (Boolean) <false> - Prepend an XML declaration
     - logo (Object) - A logo drawn over the center (see below)
     - frame (Object) - A decorative band around the symbol (see below)

*/

const svg = QRCode.encode("https://rabbit-company.com").toSVG({
	scale: 8,
	title: "Rabbit Company",
});

// Or in one step
const quick = toSVG("https://rabbit-company.com", { scale: 8 });
```

The dark modules are emitted as a single `<path>`, so the output stays small enough to inline in a page or a data URL.

### 5. Render as a data URL

```js
// Ready to use as an <img> source
document.querySelector("img").src = toDataURL("https://rabbit-company.com", { scale: 8 });
```

### 6. Render in a terminal

```js
/*

  Parameters:
  1. options (Object) <optional>
     - margin (Number) <2> - Quiet zone width in modules
     - compact (Boolean) <true> - Use half-height blocks so the code is square
     - inverse (Boolean) <false> - Swap dark and light, for light terminals

*/

console.log(toText("https://rabbit-company.com"));
```

Terminals with a light background need `inverse: true`, otherwise the contrast is reversed and the code will not scan.

### 7. Access the raw modules

```js
const qr = QRCode.encode("https://rabbit-company.com");

// One module at a time (true is dark)
qr.getModule(0, 0); // true

// Or the whole grid, row-major
const grid = qr.toArray();

// Draw it onto a canvas yourself
const ctx = canvas.getContext("2d");
const scale = 8;
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#000000";
for (let y = 0; y < qr.size; y++) {
	for (let x = 0; x < qr.size; x++) {
		if (qr.getModule(x, y)) ctx.fillRect(x * scale, y * scale, scale, scale);
	}
}
```

## Error correction

| Level | Recovers | Use for                                            |
| ----- | -------- | -------------------------------------------------- |
| `L`   | ~7%      | Clean digital display, maximum data                |
| `M`   | ~15%     | The usual default                                  |
| `Q`   | ~25%     | Print, or codes that may be partly obscured        |
| `H`   | ~30%     | Harsh environments, or a logo overlaid on the code |

By default `boostEcc` raises the level as far as the chosen symbol allows without growing it, so you often get stronger correction than you asked for at no cost in size.

## Payload formats

A QR code carries a string, and the meaning comes from conventions like `WIFI:` or `otpauth://`. These formats look trivial and are not: each has escaping or encoding rules that, got wrong, produce a perfectly scannable code carrying the wrong data. The builders live in a separate entrypoint so the core stays small.

```js
import { QRCode } from "@rabbit-company/qrcode";
import { url, wifi, totp, email, tel, sms, geo, mecard, vcard, event, text } from "@rabbit-company/qrcode/payload";

// A password containing a semicolon would end the field early if unescaped
const network = wifi({ ssid: "Cafe; Guest", password: "pa:ss;word" });
// "WIFI:T:WPA;S:Cafe\; Guest;P:pa\:ss\;word;;"

QRCode.encode(network, { errorCorrectionLevel: ErrorCorrectionLevel.QUARTILE });
```

| Builder                                      | Produces                  | Standard            |
| -------------------------------------------- | ------------------------- | ------------------- |
| `url(input, options?)`                       | the URL, case-folded      | RFC 3986            |
| `text(value)`                                | the value unchanged       | -                   |
| `email({ to, subject, body, cc, bcc })`      | `mailto:`                 | RFC 6068            |
| `tel(number)`                                | `tel:`                    | RFC 3966            |
| `sms({ to, message, format })`               | `SMSTO:` or `sms:`        | ZXing / RFC 5724    |
| `geo(lat, lon, options?)`                    | `geo:`                    | RFC 5870            |
| `wifi({ ssid, password, security, hidden })` | `WIFI:`                   | de facto            |
| `totp(options)` / `hotp(options)`            | `otpauth://`              | Key Uri Format      |
| `mecard(contact)` / `vcard(contact)`         | `MECARD:` / `BEGIN:VCARD` | de facto / RFC 6350 |
| `event({ title, start, end, ... })`          | `BEGIN:VEVENT`            | RFC 5545            |
| `bitcoin(address, options?)`                 | `bitcoin:`                | BIP-21 / BIP-173    |
| `bip21(scheme, address, options?)`           | any BIP-21 coin           | BIP-21              |
| `ethereum(options)` / `erc20(options)`       | `ethereum:`               | EIP-681             |
| `solana(recipient, options?)`                | `solana:`                 | Solana Pay          |
| `monero(address, options?)`                  | `monero:`                 | Monero URI          |
| `lightning(invoice, options?)`               | `LIGHTNING:`              | BOLT-11             |
| `upi(options)`                               | `upi://pay`               | NPCI UPI            |
| `epc(options)`                               | GiroCode block            | EPC069-12           |
| `upn(options)`                               | `UPNQR` block             | ZBS UPN QR          |
| `latin2(text)`                               | ISO-8859-2 bytes          | ISO/IEC 8859-2      |
| `gs1(options)`                               | GS1 Digital Link          | GS1                 |
| `pix(options)`                               | EMV TLV with CRC-16       | EMV QRCPS / BCB     |

Every builder validates its input and throws a `RangeError` rather than emitting a payload that would scan but not work: an invalid base32 TOTP secret, a WPA key of the wrong length, a latitude past 90.

### URLs encode smaller in uppercase

QR alphanumeric mode packs two characters into 11 bits, but its character set has no lowercase letters, so a lowercase URL falls back to byte mode at 8 bits per character. URL schemes and hosts are case-insensitive, so `url()` uppercases them by default:

```js
url("https://rabbit-company.com/"); // "HTTPS://RABBIT-COMPANY.COM/"
```

That one change takes this URL from a version 3 symbol to a version 2 (29x29 modules down to 25x25). Measured across host lengths 3 to 45, folding drops a whole version for **77%** of bare domain URLs, and **36%** of URLs that also carry a lowercase path. It never helps `otpauth://`, whose `?secret=&issuer=` parameters sit outside the alphanumeric set regardless.

Paths, queries and fragments are case-sensitive and are never touched, nor is userinfo before an `@`, nor a punycode host, where RFC 3492 gives case meaning. Pass `{ compact: false }` to get the URL back exactly as supplied.

### Wi-Fi and contact escaping

`WIFI:` uses `;` between fields and `:` between key and value, so those characters plus `\`, `,` and `"` must be backslash-escaped inside a value. A value that is an even number of hex digits is read as hex bytes rather than text, so `wifi()` quotes it, unless its length is a genuine hex key length (10 or 26 for WEP, 64 for a raw WPA pre-shared key), where the hex reading is what you want.

`MECARD:` and vCard escape different character sets from each other, and both differ from `WIFI:`. `mecard()` is far more compact, which matters at QR sizes. `vcard()` is the actual standard and is what iOS handles best.

### Crypto payment requests

Two traps dominate here, and both are silent.

**Amounts must be plain decimal.** BIP-21 amounts are in BTC, not satoshis, and JavaScript's default formatting betrays you at exactly the wrong scale: `String(0.00000001)` is `"1e-8"`, which no wallet parses. The builders format without exponents and trim trailing zeros.

```js
bitcoin("bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d", { amount: 0.00000001 });
// amount=0.00000001
```

**Case means different things on different chains.** A bech32 Bitcoin address is case-insensitive, and BIP-173 recommends uppercasing it in QR codes precisely so the symbol can use alphanumeric mode. An Ethereum address is the opposite: its mixed case _is_ the EIP-55 checksum. So `bitcoin()` folds bech32 and leaves legacy base58 alone, while `ethereum()` never folds anything.

```js
bitcoin("bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d", { amount: 0.001 });
// "BITCOIN:bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d?amount=0.001"
```

Folding takes that request from a version 5 symbol to a version 4. Pass `{ compact: false }` to keep the address exactly as supplied.

Ether values are in wei, where one ether is 10^18, past `Number.MAX_SAFE_INTEGER`. `value` therefore accepts a `bigint` or a digit string and rejects `number` outright, rather than losing precision quietly. ERC-20 transfers follow EIP-681 in targeting the token contract with the recipient as an argument:

```js
erc20({ contract: usdc, to: recipient, amount: 1_000_000n });
// "ethereum:0xA0b8...eB48/transfer?address=0x2f2C...A4a0&uint256=1000000"
```

Addresses are checked for shape, not for a valid checksum. Verifying a bech32 or EIP-55 checksum needs machinery beyond a QR library, so a typo that keeps the right shape will still encode.

### Regional payment formats

Four of these are worth calling out because they are not URIs.

**UPI** (India) is a `upi://pay` URI, but amounts are in rupees to two decimals and the currency is always `INR`, so the builder sets it for you.

**EPC QR**, also called a GiroCode, is a block of newline separated lines at fixed positions rather than a URI. The builder verifies the IBAN with its **mod-97 checksum**, so a mistyped account is caught rather than encoded, and enforces the standard's 331 byte cap. A structured creditor reference and a free-text remittance occupy alternative lines of the same block, so giving both is an error rather than a silent overwrite.

```js
epc({ name: "Rabbit Company", iban: "DE89 3704 0044 0532 0130 00", amount: 12.5, remittance: "Invoice 2026-014" });
// "BCD\n002\n1\nSCT\n\nRabbit Company\nDE89370400440532013000\nEUR12.50\n\n\nInvoice 2026-014"
```

**UPN QR** is the Slovenian universal payment order, and it is what Slovenian bank applications read for _skeniraj in placaj_. It is **not** interchangeable with the EPC GiroCode above, which is an Austrian and German convention that Slovenian apps do not accept. Three things differ:

- The amount travels as **cents padded to eleven digits**, so 12.50 euro is `00000001250` rather than `EUR12.50`.
- The payload carries a **three digit control sum** counting the characters of the nineteen fields including their line terminators, and the payload ends there with no further newline.
- The character set is **ISO-8859-2**, not UTF-8.

That last point needs care, because this library encodes text as UTF-8, where `c` with a caron takes two bytes instead of one. A UPN QR built with `QRCode.encode` would show mojibake in a bank application, so pair `upn()` with `latin2()` and `encodeBinary`:

```js
import { QRCode } from "@rabbit-company/qrcode";
import { latin2, upn } from "@rabbit-company/qrcode/payload";

const payload = upn({
	recipientIban: "SI56 2633 0001 2039 086",
	recipientName: "Rabbit Company",
	recipientCity: "1000 Ljubljana",
	amount: 12.5,
	purpose: "Racun 2026-014",
});

const qr = QRCode.encodeBinary(latin2(payload));
```

`latin2()` throws rather than substituting when a character has no Latin-2 form, since quietly mangling a payment instruction is worse than refusing to build it. The recipient IBAN is checked with its mod-97 checksum, and every field is length-capped to the standard.

**GS1 Digital Link** verifies the GTIN's **mod-10 check digit** and pads to the canonical 14 digits, which is safe because the weights alternate from the right so a leading zero changes nothing. Qualifiers must appear in the order CPV, lot, serial to be a conformant link, and the builder emits them that way regardless of the order you pass them.

```js
gs1({ gtin: "9521234543213", lot: "LOT-A", serial: "S1", attributes: { 17: "251231" } });
// "https://id.gs1.org/01/09521234543213/10/LOT-A/21/S1?17=251231"
```

**PIX** (Brazil) follows the EMV merchant-presented QR standard, so the payload is a chain of tag-length-value fields closed by a **CRC-16/CCITT-FALSE** checksum. Every field carries its own two digit length, and one wrong length byte desynchronizes the whole parse, so this is the format least forgiving of hand assembly.

```js
pix({ key: "alice@example.com", name: "Rabbit Company", city: "SAO PAULO", amount: 10.5, reference: "ORDER7" });
```

Field lengths are validated against the standards, so an over-long merchant name is refused rather than truncated into an unscannable payload.

### Choosing an SMS format

`sms()` emits `SMSTO:number:message` by default. That convention originated with ZXing and is what most scanner apps implement. Pass `{ format: "rfc" }` for the RFC 5724 `sms:number?body=` form, which is the real standard but less widely supported. They are not interchangeable.

## Frames

A colored band around the symbol, optionally captioned. A framed code reads as something meant to be scanned, which is why payment and donation pages tend to use one.

```js
const svg = QRCode.encode(address, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH }).toSVG({
	scale: 12,
	margin: 4,
	dark: "#333333",
	frame: {
		width: 3,
		fill: { from: "#f9be23", to: "#f2660f" },
		title: "Bitcoin",
		caption: "BTC",
	},
});
```

```js
/*

  frame options:
  - width (Number) <4> - Band thickness in modules
  - fill (String|Object) <"#333333"> - A color, or { from, to } to shade the sides
  - title (String) - Caption centered along the top band
  - caption (String) - Caption centered along the bottom band
  - textColor (String) <"#ffffff"> - Color of both captions
  - titleColor (String) - Top caption color, overriding textColor
  - captionColor (String) - Bottom caption color, overriding textColor
  - fontSize (Number) <70% of the band> - Caption size in modules
  - fontFamily (String) - Caption font stack

*/
```

The band is drawn **outside the quiet zone**, so the image grows rather than the light border being painted over. `margin` is therefore also **the white space between the symbol and the band**. There is no separate padding option, because raising `margin` and adding padding would render identically.

A framed symbol needs far less quiet zone than a bare one. The specification asks for 4 modules, but a band is a flat area rather than anything module-like, so a decoder finds the symbol's edge against it easily. Measured with jsQR at a 13 pixel module size:

| Band                       | `margin` 0 | 1       | 2       | 3       | 4       |
| -------------------------- | ---------- | ------- | ------- | ------- | ------- |
| Light `#f5f5f5`            | decodes    | decodes | decodes | decodes | decodes |
| Mid `#f9be23` to `#f2660f` | decodes    | decodes | decodes | decodes | decodes |
| Dark `#333333`             | **fails**  | decodes | decodes | decodes | decodes |
| Near-black `#111111`       | **fails**  | decodes | decodes | decodes | decodes |

Only a zero quiet zone actually breaks, and then only for a dark band, which merges into the edge of the symbol. So `toSVG` throws a `RangeError` below 1 module and permits everything above it. Use 1 or 2 for a compact framed code, and more when it will be printed or scanned at an angle.

A single `fill` paints a flat band. A `{ from, to }` pair paints four trapezoids instead, each with its own shade (lightest along the top, darkest along the bottom), so the corners show the diagonal seams of a mitered picture frame. Because the intermediate shades are mixed numerically, both stops have to be hexadecimal. A named color throws rather than silently falling back.

`textColor` sets both captions at once, and `titleColor` or `captionColor` override it individually. That matters on a shaded band, where a color legible against the light top of the gradient is often not legible against the dark bottom:

```js
frame: {
	width: 3,
	fill: { from: "#f9be23", to: "#f2660f" },
	title: "Bitcoin",
	caption: "BTC",
	titleColor: "#1f2937",
	captionColor: "#ffffff",
}
```

Captions are drawn as text rather than outlines, so they resolve against fonts on whatever device renders the SVG and may differ between platforms. Rounded outer corners are best left to CSS `border-radius` on the element holding the SVG.

## Logos

A logo can be drawn over the center of the symbol. The modules underneath are left out of the path rather than painted over, so a logo with transparency shows the background through instead of a module edge.

```js
/*

  logo options:
  - content (String) - A data: URI, or an SVG fragment starting with "<"
  - size (Number) <20% of the symbol> - Side length in modules
  - padding (Number) <1> - Modules of clearance around the logo
  - background (String) <the light color> - Fill behind the logo
  - skipChecks (Boolean) <false> - Bypass the scannability checks

*/

const svg = QRCode.encode("https://rabbit-company.com", {
	errorCorrectionLevel: ErrorCorrectionLevel.HIGH,
}).toSVG({
	scale: 8,
	logo: {
		content: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#e11d48"/></svg>',
		padding: 2,
	},
});
```

`content` is either a `data:` URI, referenced from an `<image>` element, or an SVG fragment. **A fragment is inserted into the output verbatim**, so it must be well-formed XML and must come from a source you trust. Give it a `viewBox` and no `width`/`height` so it scales to the space reserved for it.

Avoid `http:` and `https:` URIs. They resolve when the SVG is inlined in a page, but an SVG loaded through `toDataURL` into an `<img>` may not load external resources, and the logo then vanishes with no error.

### Why this needs care

Nothing in ISO/IEC 18004 reserves space for a logo. One works only because the error correction codewords can reconstruct the data it hides, so the covered area is charged against the same budget that protects the symbol against dirt, glare and wear. `toSVG` throws a `RangeError` when a logo would cover a finder pattern, or when it hides more modules than the error correction could possibly recover.

That second bound is a hard ceiling, not a safe limit. It assumes the hidden modules spread evenly across every error correction block and spends the whole budget on the logo. Decoding starts failing somewhat before it. Measured against jsQR, for `https://rabbit-company.com`:

| Level | Symbol | Default logo | Largest that decoded | Refused from |
| ----- | ------ | ------------ | -------------------- | ------------ |
| `M`   | v2, 25 | 5            | 5                    | 6            |
| `Q`   | v3, 29 | 5            | 9                    | 10           |
| `H`   | v4, 33 | 6            | 11                   | 14           |

At `M` and `Q` the check refuses exactly where decoding stops working. At `H` there is a gap: sizes 12 and 13 pass the check but did not decode. The default is well inside the safe zone at every level, so if you raise it, test the result against real scanners rather than trusting the check to catch a bad value. Use level `Q` or `H`, which is what makes the room in the first place.

Two further things the checks do not cover. From version 7 up there is an alignment pattern at the exact center of the symbol, which a centered logo will cover. Decoders use those to correct for perspective distortion, so losing one matters more on a curved or angled surface than on a flat print. And `toString` has no way to draw a logo, so it ignores the option.

## Capacity

The largest symbol (version 40) holds 7089 digits, 4296 alphanumeric characters or 2953 bytes at level `L`. Encoding throws a `RangeError` when the data does not fit:

```js
try {
	QRCode.encode(hugeString, { errorCorrectionLevel: ErrorCorrectionLevel.HIGH });
} catch (err) {
	// RangeError: Data is too long ...
}
```

## Mixed-mode segmentation

Text is split into the cheapest combination of encoding modes automatically. This matters for anything that mixes lowercase text with a long run of digits or uppercase, where encoding the whole string as bytes wastes space:

```js
const url = "https://rabbit-company.com/invoice/2024001234567890";
const options = { errorCorrectionLevel: ErrorCorrectionLevel.QUARTILE, boostEcc: false };

// The digits become their own numeric segment
QRCode.encode(url, options).version; // 4

// Forcing byte mode for the whole string needs a larger symbol
QRCode.encodeBinary(new TextEncoder().encode(url), options).version; // 5
```

Whether splitting helps depends on the exact content: a mode switch costs a new indicator plus a character count field, so short runs are cheaper left where they are. The library works this out per symbol version and picks whichever is smaller.

## Notes

- Kanji mode is not implemented. Japanese text is encoded as UTF-8 in byte mode, which is a little larger but decodes correctly everywhere.
- ECI mode is not implemented. Byte mode content is UTF-8, which every modern reader handles.
