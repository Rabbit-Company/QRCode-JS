import { QRCode, ErrorCorrectionLevel, type FrameOptions, type LogoOptions, type SVGOptions } from "./qrcode.ts";
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
	type OtpAlgorithm,
	type WifiSecurity,
} from "./payload.ts";

/**
 * Demo page wiring.
 *
 * Bundled to `dist/` by build.ts and paired with `src/index.html`, so the
 * library can be tried without installing anything.
 */

const form = document.getElementById("form") as HTMLFormElement;
const formatSelect = document.getElementById("format") as HTMLSelectElement;
const fieldsHost = document.getElementById("fields") as HTMLDivElement;
const formatHint = document.getElementById("format-hint") as HTMLParagraphElement;
const level = document.getElementById("level") as HTMLSelectElement;
const mask = document.getElementById("mask") as HTMLSelectElement;
const scale = document.getElementById("scale") as HTMLInputElement;
const marginInput = document.getElementById("margin") as HTMLInputElement;
const dark = document.getElementById("dark") as HTMLInputElement;
const light = document.getElementById("light") as HTMLInputElement;
const logoFile = document.getElementById("logo") as HTMLInputElement;
const logoSize = document.getElementById("logo-size") as HTMLInputElement;
const logoPadding = document.getElementById("logo-padding") as HTMLInputElement;
const logoBackground = document.getElementById("logo-background") as HTMLInputElement;
const logoClear = document.getElementById("logo-clear") as HTMLButtonElement;
const frameWidth = document.getElementById("frame-width") as HTMLInputElement;
const frameShaded = document.getElementById("frame-shaded") as HTMLInputElement;
const frameFrom = document.getElementById("frame-from") as HTMLInputElement;
const frameTo = document.getElementById("frame-to") as HTMLInputElement;
const frameTitle = document.getElementById("frame-title") as HTMLInputElement;
const frameCaption = document.getElementById("frame-caption") as HTMLInputElement;
const frameTitleColor = document.getElementById("frame-title-color") as HTMLInputElement;
const frameCaptionColor = document.getElementById("frame-caption-color") as HTMLInputElement;
const output = document.getElementById("output") as HTMLDivElement;
const info = document.getElementById("info") as HTMLParagraphElement;
const note = document.getElementById("note") as HTMLParagraphElement;
const payload = document.getElementById("payload") as HTMLPreElement;
const download = document.getElementById("download") as HTMLAnchorElement;

/**
 * Largest logo the page will accept. The image is inlined into the SVG as a
 * data URI, so a big file makes an unwieldy download for no visible gain at
 * the handful of modules a logo occupies.
 */
const MAX_LOGO_BYTES = 256 * 1024;

/** One input in a format's field set. */
interface Field {
	/** Key within the format, used for the stored value and the element id. */
	name: string;
	/** Visible label. */
	label: string;
	/** Which control to render. Defaults to a single-line text input. */
	kind?: "text" | "textarea" | "number" | "checkbox" | "select" | "datetime" | "date";
	/** Initial value, so every format shows a working code immediately. */
	value?: string;
	/** Choices for a `"select"` field. */
	choices?: readonly string[];
	/** Sit two fields side by side in one row. */
	half?: boolean;
}

/** Reads the current field values of the active format. */
interface Values {
	/** Trimmed value, or undefined when blank. */
	str(name: string): string | undefined;
	/** Trimmed value, blank included, for a field the builder itself validates. */
	req(name: string): string;
	/** Parsed number, or undefined when blank. */
	num(name: string): number | undefined;
	/** Checkbox state. */
	bool(name: string): boolean;
	/** Comma or newline separated entries, or undefined when blank. */
	list(name: string): string[] | undefined;
	/** Parsed date, or undefined when blank. */
	date(name: string): Date | undefined;
	/** Parsed date, throwing when blank. */
	reqDate(name: string): Date;
}

/** A payload format offered by the demo. */
interface Format {
	/** Value used in the selector and as the stored-value prefix. */
	id: string;
	/** Visible name. */
	label: string;
	/** What is worth knowing about this format, shown under the fields. */
	hint?: string;
	/** Inputs to render. */
	fields: readonly Field[];
	/** Builds the payload from the current values. */
	build(values: Values): string;
	/**
	 * Character set the payload must be encoded in.
	 *
	 * Only UPN QR departs from UTF-8, and it has to, since a bank application
	 * reads its bytes as ISO-8859-2.
	 *
	 * @default "utf-8"
	 */
	charset?: "utf-8" | "iso-8859-2";
}

/**
 * The formats, in the order they appear in the selector.
 *
 * Defaults are chosen so switching to a format immediately produces a valid
 * code, and so the escaping-sensitive ones start with characters that would
 * break a naive implementation.
 */
const FORMATS: readonly Format[] = [
	{
		id: "text",
		label: "Plain text",
		hint: "Text needs no format of its own. A QR code holding a bare string is read as that string.",
		fields: [{ name: "value", label: "Text", kind: "textarea", value: "BurrowGate" }],
		build: (v) => text(v.req("value")),
	},
	{
		id: "url",
		label: "Website (URL)",
		hint: "The scheme and host are case-insensitive, so uppercasing them lets QR alphanumeric mode pack two characters into 11 bits. Watch the version drop when you tick it.",
		fields: [
			{ name: "url", label: "URL", value: "https://rabbit-company.com/" },
			{ name: "compact", label: "Uppercase scheme and host", kind: "checkbox", value: "true" },
		],
		build: (v) => url(v.req("url"), { compact: v.bool("compact") }),
	},
	{
		id: "email",
		label: "Email",
		fields: [
			{ name: "to", label: "To", value: "info@rabbit-company.com" },
			{ name: "cc", label: "Cc", half: true },
			{ name: "bcc", label: "Bcc", half: true },
			{ name: "subject", label: "Subject", value: "50% off & more?" },
			{ name: "body", label: "Body", kind: "textarea" },
		],
		build: (v) =>
			email({
				to: v.list("to") ?? "",
				cc: v.list("cc"),
				bcc: v.list("bcc"),
				subject: v.str("subject"),
				body: v.str("body"),
			}),
	},
	{
		id: "tel",
		label: "Phone number",
		hint: "Spaces, dots, dashes and brackets are decoration per RFC 3966 and are stripped.",
		fields: [{ name: "number", label: "Number", value: "+386 (1) 234-5678" }],
		build: (v) => tel(v.req("number")),
	},
	{
		id: "sms",
		label: "Text message (SMS)",
		hint: "SMSTO is what most scanner apps implement. The sms: form is the RFC 5724 standard but less widely handled, and the two are not interchangeable.",
		fields: [
			{ name: "to", label: "Number", value: "+386 1 234 5678", half: true },
			{ name: "format", label: "Convention", kind: "select", choices: ["smsto", "rfc"], half: true },
			{ name: "message", label: "Message", kind: "textarea", value: "Meet at 10:30" },
		],
		build: (v) =>
			sms({
				to: v.req("to"),
				message: v.str("message"),
				format: v.req("format") === "rfc" ? "rfc" : "smsto",
			}),
	},
	{
		id: "geo",
		label: "Location",
		fields: [
			{ name: "latitude", label: "Latitude", kind: "number", value: "46.0569", half: true },
			{ name: "longitude", label: "Longitude", kind: "number", value: "14.5058", half: true },
			{ name: "altitude", label: "Altitude (m)", kind: "number", half: true },
			{ name: "uncertainty", label: "Uncertainty (m)", kind: "number", half: true },
		],
		build: (v) =>
			geo(v.num("latitude") ?? 0, v.num("longitude") ?? 0, {
				altitude: v.num("altitude"),
				uncertainty: v.num("uncertainty"),
			}),
	},
	{
		id: "wifi",
		label: "Wi-Fi network",
		hint: "Semicolons, colons, commas, backslashes and quotes are escaped. A password that is an even number of hex digits gets quoted so it reads as text, unless its length is a real hex key length.",
		fields: [
			{ name: "ssid", label: "Network name", value: "Cafe; Guest" },
			{ name: "password", label: "Password", value: "pa:ss;word" },
			{ name: "security", label: "Security", kind: "select", choices: ["WPA", "WEP", "nopass"], half: true },
			{ name: "hidden", label: "Hidden network", kind: "checkbox", half: true },
		],
		build: (v) => {
			const security = v.req("security") as WifiSecurity;
			return wifi({
				ssid: v.req("ssid"),
				password: security === "nopass" ? undefined : v.str("password"),
				security,
				hidden: v.bool("hidden"),
			});
		},
	},
	{
		id: "totp",
		label: "Two-factor secret (TOTP)",
		hint: "The secret must be RFC 4648 base32. Anything else would produce an authenticator that generates permanently wrong codes, so it is rejected here instead.",
		fields: [
			{ name: "issuer", label: "Issuer", value: "Rabbit Company", half: true },
			{ name: "account", label: "Account", value: "alice@example.com", half: true },
			{ name: "secret", label: "Secret (base32)", value: "JBSWY3DPEHPK3PXP" },
			{ name: "algorithm", label: "Algorithm", kind: "select", choices: ["SHA1", "SHA256", "SHA512"], half: true },
			{ name: "digits", label: "Digits", kind: "select", choices: ["6", "8"], half: true },
			{ name: "period", label: "Period (s)", kind: "number", value: "30" },
		],
		build: (v) =>
			totp({
				issuer: v.str("issuer"),
				account: v.req("account"),
				secret: v.req("secret"),
				algorithm: v.req("algorithm") as OtpAlgorithm,
				digits: v.num("digits"),
				period: v.num("period"),
			}),
	},
	{
		id: "hotp",
		label: "Two-factor secret (HOTP)",
		fields: [
			{ name: "issuer", label: "Issuer", value: "Rabbit Company", half: true },
			{ name: "account", label: "Account", value: "alice@example.com", half: true },
			{ name: "secret", label: "Secret (base32)", value: "JBSWY3DPEHPK3PXP" },
			{ name: "counter", label: "Counter", kind: "number", value: "0", half: true },
			{ name: "digits", label: "Digits", kind: "select", choices: ["6", "8"], half: true },
		],
		build: (v) =>
			hotp({
				issuer: v.str("issuer"),
				account: v.req("account"),
				secret: v.req("secret"),
				counter: v.num("counter") ?? 0,
				digits: v.num("digits"),
			}),
	},
	{
		id: "mecard",
		label: "Contact (MECARD)",
		hint: "Far more compact than vCard, which matters at QR sizes, and well supported by Android scanners.",
		fields: [
			{ name: "firstName", label: "First name", value: "Alice", half: true },
			{ name: "lastName", label: "Last name", value: "Smith", half: true },
			{ name: "organization", label: "Organization", value: "Rabbit Company" },
			{ name: "phones", label: "Phone numbers", value: "+386 1 234 5678", half: true },
			{ name: "emails", label: "Email addresses", value: "alice@example.com", half: true },
			{ name: "urls", label: "Websites", half: true },
			{ name: "note", label: "Note", half: true },
		],
		build: (v) =>
			mecard({
				firstName: v.str("firstName"),
				lastName: v.str("lastName"),
				organization: v.str("organization"),
				phones: v.list("phones"),
				emails: v.list("emails"),
				urls: v.list("urls"),
				note: v.str("note"),
			}),
	},
	{
		id: "vcard",
		label: "Contact (vCard)",
		hint: "The actual standard, and the form iOS handles best, at the cost of a larger symbol.",
		fields: [
			{ name: "firstName", label: "First name", value: "Alice", half: true },
			{ name: "lastName", label: "Last name", value: "Smith", half: true },
			{ name: "organization", label: "Organization", value: "Rabbit Company", half: true },
			{ name: "title", label: "Job title", half: true },
			{ name: "phones", label: "Phone numbers", value: "+386 1 234 5678", half: true },
			{ name: "emails", label: "Email addresses", value: "alice@example.com", half: true },
			{ name: "urls", label: "Websites", value: "https://rabbit-company.com", half: true },
			{ name: "note", label: "Note", half: true },
		],
		build: (v) =>
			vcard({
				firstName: v.str("firstName"),
				lastName: v.str("lastName"),
				organization: v.str("organization"),
				title: v.str("title"),
				phones: v.list("phones"),
				emails: v.list("emails"),
				urls: v.list("urls"),
				note: v.str("note"),
			}),
	},
	{
		id: "bitcoin",
		label: "Bitcoin payment",
		hint: "The amount is in BTC, not satoshis, and is written in plain decimal because no wallet parses exponent notation. A bech32 address is uppercased, which BIP-173 recommends for QR codes.",
		fields: [
			{ name: "address", label: "Address", value: "bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d" },
			{ name: "amount", label: "Amount (BTC)", value: "0.001", half: true },
			{ name: "compact", label: "Uppercase bech32", kind: "checkbox", value: "true", half: true },
			{ name: "label", label: "Payee", value: "Rabbit Company", half: true },
			{ name: "message", label: "Message", half: true },
		],
		build: (v) =>
			bitcoin(v.req("address"), {
				amount: v.str("amount"),
				label: v.str("label"),
				message: v.str("message"),
				compact: v.bool("compact"),
			}),
	},
	{
		id: "bip21",
		label: "Other BIP-21 coin",
		hint: "Litecoin, Dogecoin, Dash and others share the BIP-21 shape and differ only in the scheme name.",
		fields: [
			{ name: "scheme", label: "Scheme", value: "litecoin", half: true },
			{ name: "amount", label: "Amount", value: "1.5", half: true },
			{ name: "address", label: "Address", value: "ltc1qg9anxcyd9pnk8lzyc8jmz9nzqp7cn5pn0v3sph" },
			{ name: "label", label: "Payee", half: true },
			{ name: "message", label: "Message", half: true },
		],
		build: (v) =>
			bip21(v.req("scheme"), v.req("address"), {
				amount: v.str("amount"),
				label: v.str("label"),
				message: v.str("message"),
			}),
	},
	{
		id: "ethereum",
		label: "Ethereum payment",
		hint: "The value is in wei, so one ether is 10^18. The mixed case of the address is its EIP-55 checksum, so it is never folded.",
		fields: [
			{ name: "to", label: "Recipient", value: "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7" },
			{ name: "value", label: "Value (wei)", value: "1000000000000000000", half: true },
			{ name: "chainId", label: "Chain id", kind: "number", half: true },
		],
		build: (v) =>
			ethereum({
				to: v.req("to"),
				value: v.str("value"),
				chainId: v.num("chainId"),
			}),
	},
	{
		id: "erc20",
		label: "ERC-20 token transfer",
		hint: "The URI targets the token contract and carries the recipient as a transfer argument, which is what EIP-681 specifies. The amount is in the token's smallest unit, so 1000000 is one USDC.",
		fields: [
			{ name: "contract", label: "Token contract", value: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
			{ name: "to", label: "Recipient", value: "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7" },
			{ name: "amount", label: "Amount (smallest unit)", value: "1000000", half: true },
			{ name: "chainId", label: "Chain id", kind: "number", half: true },
		],
		build: (v) =>
			erc20({
				contract: v.req("contract"),
				to: v.req("to"),
				amount: v.req("amount"),
				chainId: v.num("chainId"),
			}),
	},
	{
		id: "solana",
		label: "Solana Pay",
		fields: [
			{ name: "recipient", label: "Recipient", value: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH" },
			{ name: "amount", label: "Amount", value: "0.5", half: true },
			{ name: "label", label: "Payee", value: "Rabbit Company", half: true },
			{ name: "splToken", label: "SPL token mint", half: true },
			{ name: "memo", label: "Memo", half: true },
		],
		build: (v) =>
			solana(v.req("recipient"), {
				amount: v.str("amount"),
				label: v.str("label"),
				splToken: v.str("splToken"),
				memo: v.str("memo"),
			}),
	},
	{
		id: "monero",
		label: "Monero payment",
		hint: "Monero names its parameters tx_amount and tx_payment_id where the BIP-21 currencies use amount.",
		fields: [
			{ name: "address", label: "Address", value: "8BmrgB8NGWhe8TSjNJDNMKgHrvxEQP1ZUDTWMNWA8CnKMpQjBjZhje1DPMmkbdNyMZESZDvHgMyufe5KPtLgy41Q8MTWnBE" },
			{ name: "amount", label: "Amount (XMR)", value: "0.25", half: true },
			{ name: "recipientName", label: "Payee", value: "Rabbit Company", half: true },
			{ name: "description", label: "Description", half: true },
			{ name: "paymentId", label: "Payment id", half: true },
		],
		build: (v) =>
			monero(v.req("address"), {
				amount: v.str("amount"),
				recipientName: v.str("recipientName"),
				description: v.str("description"),
				paymentId: v.str("paymentId"),
			}),
	},
	{
		id: "lightning",
		label: "Lightning invoice",
		hint: "BOLT-11 invoices are bech32, so like a bech32 address they are uppercased to let the symbol use alphanumeric mode.",
		fields: [
			{ name: "invoice", label: "Invoice", kind: "textarea", value: "lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq" },
			{ name: "compact", label: "Uppercase for the symbol", kind: "checkbox", value: "true" },
		],
		build: (v) => lightning(v.req("invoice"), { compact: v.bool("compact") }),
	},
	{
		id: "upi",
		label: "UPI payment (India)",
		hint: "Amounts are in rupees with two decimals. UPI settles only in INR, so the currency is always set for you.",
		fields: [
			{ name: "payeeAddress", label: "Payee VPA", value: "merchant@bank", half: true },
			{ name: "payeeName", label: "Payee name", value: "Rabbit Company", half: true },
			{ name: "amount", label: "Amount (INR)", value: "250.50", half: true },
			{ name: "merchantCode", label: "Category code", half: true },
			{ name: "note", label: "Note", value: "Order 7", half: true },
			{ name: "reference", label: "Reference", half: true },
		],
		build: (v) =>
			upi({
				payeeAddress: v.req("payeeAddress"),
				payeeName: v.req("payeeName"),
				amount: v.str("amount"),
				merchantCode: v.str("merchantCode"),
				note: v.str("note"),
				reference: v.str("reference"),
			}),
	},
	{
		id: "epc",
		label: "SEPA transfer (GiroCode)",
		hint: "The IBAN is checked with its mod-97 checksum, and the whole payload must fit in 331 bytes. A structured reference and free-text remittance are mutually exclusive.",
		fields: [
			{ name: "name", label: "Beneficiary", value: "Rabbit Company" },
			{ name: "iban", label: "IBAN", value: "DE89 3704 0044 0532 0130 00" },
			{ name: "bic", label: "BIC", half: true },
			{ name: "amount", label: "Amount (EUR)", value: "12.50", half: true },
			{ name: "remittance", label: "Remittance text", value: "Invoice 2026-014" },
			{ name: "purpose", label: "Purpose code", half: true },
			{ name: "information", label: "Information", half: true },
		],
		build: (v) =>
			epc({
				name: v.req("name"),
				iban: v.req("iban"),
				bic: v.str("bic"),
				amount: v.str("amount"),
				remittance: v.str("remittance"),
				purpose: v.str("purpose"),
				information: v.str("information"),
			}),
	},
	{
		id: "upn",
		label: "UPN QR (Slovenia)",
		charset: "iso-8859-2",
		hint: "This is what Slovenian bank apps read for skeniraj in placaj. They do not read the EPC GiroCode above. The IBAN below is a made-up number that only satisfies the international mod-97 check, so a bank will parse the code and then refuse to price it. Put your own account in to test properly.",
		fields: [
			{ name: "recipientIban", label: "Recipient IBAN", value: "SI56 2633 0001 2039 086" },
			{ name: "recipientName", label: "Recipient", value: "Rabbit Company", half: true },
			{ name: "recipientStreet", label: "Recipient street", value: "Cigaletova ulica 15", half: true },
			{ name: "recipientCity", label: "Recipient town", value: "1000 Ljubljana", half: true },
			{ name: "recipientReference", label: "Reference", value: "SI99", half: true },
			{ name: "amount", label: "Amount (EUR)", value: "12.50", half: true },
			{ name: "dueDate", label: "Due date (rok placila)", kind: "date", value: "2026-09-21", half: true },
			{ name: "purpose", label: "Purpose", value: "Račun 2026-014" },
			{ name: "purposeCode", label: "Purpose code", value: "OTLC", half: true },
			{ name: "urgent", label: "Urgent", kind: "checkbox", half: true },
			{ name: "payerName", label: "Payer", value: "NOVAK MARIJA", half: true },
			{ name: "payerStreet", label: "Payer street", value: "Primer 1 A", half: true },
			{ name: "payerCity", label: "Payer town", value: "1000 Ljubljana", half: true },
			{ name: "payerIban", label: "Payer IBAN", half: true },
			{ name: "payerReference", label: "Payer reference", half: true },
		],
		build: (v) =>
			upn({
				recipientIban: v.req("recipientIban"),
				recipientName: v.req("recipientName"),
				recipientStreet: v.str("recipientStreet"),
				recipientCity: v.str("recipientCity"),
				recipientReference: v.str("recipientReference"),
				amount: v.str("amount"),
				dueDate: v.date("dueDate"),
				purpose: v.str("purpose"),
				purposeCode: v.str("purposeCode"),
				urgent: v.bool("urgent"),
				payerName: v.str("payerName"),
				payerStreet: v.str("payerStreet"),
				payerCity: v.str("payerCity"),
				payerIban: v.str("payerIban"),
				payerReference: v.str("payerReference"),
			}),
	},
	{
		id: "gs1",
		label: "Product (GS1 Digital Link)",
		hint: "The GTIN check digit is verified and the code is padded to 14 digits. Qualifiers must appear in the order CPV, lot, serial to be a conformant link.",
		fields: [
			{ name: "gtin", label: "GTIN", value: "09521234543213", half: true },
			{ name: "domain", label: "Resolver", value: "https://id.gs1.org", half: true },
			{ name: "lot", label: "Batch or lot", value: "LOT-A", half: true },
			{ name: "serial", label: "Serial", value: "S1", half: true },
			{ name: "cpv", label: "Product variant", half: true },
			{ name: "expiry", label: "Expiry (AI 17)", value: "251231", half: true },
		],
		build: (v) => {
			const expiry = v.str("expiry");
			return gs1({
				gtin: v.req("gtin"),
				lot: v.str("lot"),
				serial: v.str("serial"),
				cpv: v.str("cpv"),
				domain: v.str("domain"),
				attributes: expiry === undefined ? undefined : { "17": expiry },
			});
		},
	},
	{
		id: "pix",
		label: "PIX payment (Brazil)",
		hint: "PIX is not a URI. It is a chain of tag-length-value fields ending in a CRC-16 checksum, so a single wrong length byte invalidates the whole code.",
		fields: [
			{ name: "key", label: "PIX key", value: "alice@example.com" },
			{ name: "name", label: "Merchant name", value: "Rabbit Company", half: true },
			{ name: "city", label: "Merchant city", value: "SAO PAULO", half: true },
			{ name: "amount", label: "Amount (BRL)", value: "10.50", half: true },
			{ name: "reference", label: "Reference", value: "ORDER7", half: true },
			{ name: "description", label: "Description", half: true },
			{ name: "oneTime", label: "Single use", kind: "checkbox", half: true },
		],
		build: (v) =>
			pix({
				key: v.req("key"),
				name: v.req("name"),
				city: v.req("city"),
				amount: v.str("amount"),
				reference: v.str("reference"),
				description: v.str("description"),
				oneTime: v.bool("oneTime"),
			}),
	},
	{
		id: "event",
		label: "Calendar event",
		hint: "Times are read in your browser's timezone and emitted as UTC, which is why the payload may not show the hour you typed.",
		fields: [
			{ name: "title", label: "Title", value: "Launch" },
			{ name: "start", label: "Starts", kind: "datetime", value: "2026-09-08T10:00", half: true },
			{ name: "end", label: "Ends", kind: "datetime", value: "2026-09-08T11:00", half: true },
			{ name: "allDay", label: "All day", kind: "checkbox", half: true },
			{ name: "location", label: "Location", value: "Ljubljana", half: true },
			{ name: "description", label: "Description", kind: "textarea" },
		],
		build: (v) =>
			event({
				title: v.req("title"),
				start: v.reqDate("start"),
				end: v.date("end"),
				allDay: v.bool("allDay"),
				location: v.str("location"),
				description: v.str("description"),
			}),
	},
];

/**
 * Field values, keyed `formatId.fieldName`, so switching format and back does
 * not lose what was typed.
 */
const stored = new Map<string, string>();

/** The uploaded logo, as a data URI, or undefined while none is loaded. */
let logoContent: string | undefined;

function describe(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** The format currently chosen in the selector. */
function activeFormat(): Format {
	return FORMATS.find((format) => format.id === formatSelect.value) ?? (FORMATS[0] as Format);
}

/** Builds the control for one field, restoring any value already typed. */
function control(field: Field, format: Format): HTMLElement {
	const key = `${format.id}.${field.name}`;
	const current = stored.get(key) ?? field.value ?? "";
	const id = `field-${field.name}`;

	let element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

	if (field.kind === "textarea") {
		element = document.createElement("textarea");
		element.value = current;
	} else if (field.kind === "select") {
		element = document.createElement("select");
		for (const choice of field.choices ?? []) {
			const option = document.createElement("option");
			option.value = choice;
			option.textContent = choice;
			element.append(option);
		}
		element.value = current === "" ? (field.choices?.[0] ?? "") : current;
	} else {
		element = document.createElement("input");
		element.type =
			field.kind === "number"
				? "number"
				: field.kind === "checkbox"
					? "checkbox"
					: field.kind === "datetime"
						? "datetime-local"
						: field.kind === "date"
							? "date"
							: "text";
		if (field.kind === "checkbox") element.checked = current === "true";
		else element.value = current;
		if (field.kind === "number") element.step = "any";
	}

	element.id = id;
	element.dataset.key = key;
	if (element instanceof HTMLTextAreaElement) element.spellcheck = false;

	return element;
}

/** Rebuilds the field set for the chosen format. */
function renderFields(): void {
	const format = activeFormat();
	fieldsHost.replaceChildren();

	let row: HTMLDivElement | null = null;
	for (const field of format.fields) {
		const cell = document.createElement("div");
		const label = document.createElement("label");
		label.textContent = field.label;
		label.htmlFor = `field-${field.name}`;
		cell.append(label, control(field, format));

		if (field.half === true) {
			if (row === null) {
				row = document.createElement("div");
				row.className = "row";
				fieldsHost.append(row);
			}
			row.append(cell);
			if (row.children.length === 2) row = null;
		} else {
			row = null;
			fieldsHost.append(cell);
		}
	}

	formatHint.textContent = format.hint ?? "";
	formatHint.hidden = format.hint === undefined;
}

/** Reads one field's raw string, whatever control it uses. */
function raw(name: string): string {
	const element = document.getElementById(`field-${name}`);
	if (element instanceof HTMLInputElement) return element.type === "checkbox" ? String(element.checked) : element.value;
	if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
	return "";
}

const values: Values = {
	req: (name) => raw(name).trim(),
	str: (name) => {
		const value = raw(name).trim();
		return value === "" ? undefined : value;
	},
	num: (name) => {
		const value = raw(name).trim();
		if (value === "") return undefined;
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	},
	bool: (name) => raw(name) === "true",
	list: (name) => {
		const entries = raw(name)
			.split(/[,\n]/)
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
		return entries.length === 0 ? undefined : entries;
	},
	date: (name) => {
		const value = raw(name).trim();
		if (value === "") return undefined;
		// A bare YYYY-MM-DD parses as UTC midnight, which can land on the
		// previous day once read back in local time, so build it from parts.
		const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		const parsed = parts === null ? new Date(value) : new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	},
	reqDate: (name) => {
		const parsed = values.date(name);
		if (parsed === undefined) throw new RangeError(`${name} is required.`);
		return parsed;
	},
};

/** Enables the logo controls only once there is a logo to control. */
function syncLogoControls(): void {
	const loaded = logoContent !== undefined;
	for (const element of [logoSize, logoPadding, logoBackground]) element.disabled = !loaded;
	logoClear.disabled = !loaded;
}

/**
 * Holds the quiet zone at the one module a frame needs to sit outside of.
 *
 * Without this the slider can be dragged to zero, where a dark band merges into
 * the edge of the symbol and the frame is refused, which reads as the control
 * being broken rather than as a rule being enforced.
 */
function syncQuietZone(): void {
	const framed = (Number.parseInt(frameWidth.value, 10) || 0) > 0;
	marginInput.min = framed ? "1" : "0";
	if (framed && Number.parseInt(marginInput.value, 10) < 1) marginInput.value = "1";
}

function currentFrame(): FrameOptions | undefined {
	const width = Number.parseInt(frameWidth.value, 10);
	if (width <= 0) return undefined;
	return {
		width,
		fill: frameShaded.checked ? { from: frameFrom.value, to: frameTo.value } : frameFrom.value,
		title: frameTitle.value.length === 0 ? undefined : frameTitle.value,
		caption: frameCaption.value.length === 0 ? undefined : frameCaption.value,
		titleColor: frameTitleColor.value,
		captionColor: frameCaptionColor.value,
	};
}

function currentLogo(): LogoOptions | undefined {
	if (logoContent === undefined) return undefined;
	return {
		content: logoContent,
		size: Number.parseInt(logoSize.value, 10),
		padding: Number.parseInt(logoPadding.value, 10),
		background: logoBackground.value,
	};
}

/**
 * Renders with the logo when it fits, and without it when the library refuses
 * it, so that nudging a slider one step too far explains itself instead of
 * blanking the preview.
 */
/**
 * Renders the symbol, shedding decoration until something draws.
 *
 * A frame or a logo can be refused, so the candidates are tried richest first
 * and the first error is reported. Each candidate rebuilds the options, because
 * a frame grows the canvas and the pinned pixel size has to follow.
 *
 * @param qr - The encoded symbol.
 * @param sized - Builds render options for a given band thickness in modules.
 * @param frame - The requested frame, if any.
 * @param logo - The requested logo, if any.
 * @returns The markup, the options that produced it, and the first refusal.
 */
function renderSymbol(
	qr: QRCode,
	sized: (band: number) => SVGOptions,
	frame: FrameOptions | undefined,
	logo: LogoOptions | undefined,
): { svg: string; warning: string; options: SVGOptions } {
	const candidates: { frame?: FrameOptions; logo?: LogoOptions }[] = [{ frame, logo }];
	if (logo !== undefined) candidates.push({ frame });
	if (frame !== undefined) candidates.push({ logo });
	candidates.push({});

	let warning = "";
	for (const candidate of candidates) {
		const options: SVGOptions = {
			...sized(candidate.frame?.width ?? 0),
			...(candidate.frame === undefined ? {} : { frame: candidate.frame }),
			...(candidate.logo === undefined ? {} : { logo: candidate.logo }),
		};
		try {
			return { svg: qr.toSVG(options), warning, options };
		} catch (err) {
			if (warning === "") warning = describe(err);
		}
	}

	// The last candidate carries no decoration, so reaching here means the
	// symbol itself cannot be drawn.
	throw new Error(warning);
}

function clear(message: string, encoded = ""): void {
	output.replaceChildren();
	info.textContent = "";
	note.textContent = message;
	note.hidden = message === "";
	payload.textContent = encoded;
	download.hidden = true;
}

function render(): void {
	// The builders reject input that would scan but not work, so a half-typed
	// field surfaces the library's own message rather than a blank panel.
	const format = activeFormat();
	syncQuietZone();

	let encoded: string;
	try {
		encoded = format.build(values);
	} catch (err) {
		clear(describe(err));
		return;
	}

	payload.textContent = encoded;

	if (encoded.length === 0) {
		clear("Enter some content to generate a QR code.", encoded);
		return;
	}

	const encoding = {
		errorCorrectionLevel: level.value as ErrorCorrectionLevel,
		mask: Number.parseInt(mask.value, 10),
	};

	let qr: QRCode;
	try {
		qr = format.charset === "iso-8859-2" ? QRCode.encodeBinary(latin2(encoded), encoding) : QRCode.encode(encoded, encoding);
	} catch (err) {
		clear(describe(err), encoded);
		return;
	}

	// Without width and height the SVG carries only a viewBox and stretches to
	// fill its container, which makes the module size slider invisible: the
	// coordinates and the viewBox grow together. Pinning the rendered size to
	// the symbol's natural extent makes one module exactly `scale` pixels.
	const modules = Number.parseInt(scale.value, 10);
	const margin = Number.parseInt(marginInput.value, 10);
	// A frame grows the canvas, so the band counts towards the pinned size or
	// one module stops being exactly `scale` pixels.
	const sized = (band: number): SVGOptions => ({
		margin,
		scale: modules,
		dark: dark.value,
		light: light.value,
		size: (qr.size + margin * 2 + band * 2) * modules,
	});

	let svg: string;
	let warning: string;
	let used: SVGOptions;
	try {
		({ svg, warning, options: used } = renderSymbol(qr, sized, currentFrame(), currentLogo()));
	} catch (err) {
		clear(describe(err), encoded);
		return;
	}

	output.innerHTML = svg;
	info.textContent = `Version ${qr.version} | ${qr.size}x${qr.size} modules | level ${qr.errorCorrectionLevel} | mask ${qr.mask} | ${encoded.length} characters`;
	note.textContent = warning;
	note.hidden = warning.length === 0;

	// Reuse exactly what rendered, so the download matches the preview.
	download.href = qr.toDataURL({ ...used, xmlDeclaration: true });
	download.hidden = false;
}

for (const format of FORMATS) {
	const option = document.createElement("option");
	option.value = format.id;
	option.textContent = format.label;
	formatSelect.append(option);
}
formatSelect.value = "url";

formatSelect.addEventListener("change", () => {
	renderFields();
	render();
});

logoFile.addEventListener("change", () => {
	const file = logoFile.files?.[0];
	if (file === undefined) return;

	if (file.size > MAX_LOGO_BYTES) {
		logoFile.value = "";
		note.textContent = `That image is ${Math.round(file.size / 1024)} KB. Use one under ${MAX_LOGO_BYTES / 1024} KB, since it is inlined into the SVG.`;
		note.hidden = false;
		return;
	}

	const reader = new FileReader();
	reader.addEventListener("load", () => {
		logoContent = typeof reader.result === "string" ? reader.result : undefined;
		syncLogoControls();
		render();
	});
	reader.addEventListener("error", () => {
		note.textContent = "That image could not be read.";
		note.hidden = false;
	});
	reader.readAsDataURL(file);
});

logoClear.addEventListener("click", () => {
	logoContent = undefined;
	logoFile.value = "";
	syncLogoControls();
	render();
});

// The file input is handled above. A change event from it must not re-render
// before the file has been read.
form.addEventListener("input", (browserEvent) => {
	const target = browserEvent.target;
	if (target === logoFile) return;

	// Remember field values so switching format and back keeps them.
	if (target instanceof HTMLElement && target.dataset.key !== undefined) {
		const value = target instanceof HTMLInputElement && target.type === "checkbox" ? String(target.checked) : (target as HTMLInputElement).value;
		stored.set(target.dataset.key, value);
	}

	render();
});
form.addEventListener("submit", (browserEvent) => browserEvent.preventDefault());

renderFields();
syncLogoControls();
syncQuietZone();
render();
