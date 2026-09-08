/**
 * Builders for the standard QR code payload formats.
 *
 * Every function returns a plain string to hand to
 * {@link https://jsr.io/@rabbit-company/qrcode/doc/~/QRCode.encode | QRCode.encode}.
 * They exist because these formats look trivial and are not: each has escaping
 * or encoding rules that silently produce a scannable code carrying the wrong
 * data when they are got wrong.
 *
 * @example Wi-Fi credentials
 * ```typescript
 * import { QRCode } from "@rabbit-company/qrcode";
 * import { wifi } from "@rabbit-company/qrcode/payload";
 *
 * const qr = QRCode.encode(wifi({ ssid: "Guest", password: "hunter2;pass" }));
 * ```
 *
 * @example A two-factor secret
 * ```typescript
 * import { totp } from "@rabbit-company/qrcode/payload";
 *
 * const uri = totp({
 *   issuer: "Rabbit Company",
 *   account: "alice@example.com",
 *   secret: "JBSWY3DPEHPK3PXP",
 * });
 * ```
 *
 * @module
 */

/** Options for {@link url}. */
export interface UrlOptions {
	/**
	 * Uppercase the scheme and host, which are case-insensitive per RFC 3986.
	 *
	 * QR alphanumeric mode packs two characters into 11 bits but has no
	 * lowercase letters, so a lowercase URL falls back to byte mode at 8 bits
	 * per character. Folding the parts that may safely be folded often drops the
	 * symbol a whole version. The path, query and fragment are case-sensitive
	 * and are never touched, and a punycode host (`xn--`) is left alone.
	 *
	 * @default true
	 */
	compact?: boolean;
}

/** Options for {@link email}. */
export interface EmailOptions {
	/** One or more recipients. */
	to: string | string[];
	/** Subject line. Percent-encoded for you. */
	subject?: string;
	/** Message body. Percent-encoded for you, newlines included. */
	body?: string;
	/** Carbon copy recipients. */
	cc?: string | string[];
	/** Blind carbon copy recipients. */
	bcc?: string | string[];
}

/** Options for {@link sms}. */
export interface SmsOptions {
	/** Recipient number, in the same form {@link tel} accepts. */
	to: string;
	/** Message text to prefill. */
	message?: string;
	/**
	 * Which convention to emit.
	 *
	 * `"smsto"` produces `SMSTO:number:message`, which originated with ZXing and
	 * is what most scanner apps actually implement. `"rfc"` produces the RFC
	 * 5724 `sms:number?body=message`, which is the real standard but less widely
	 * handled. They are not interchangeable.
	 *
	 * @default "smsto"
	 */
	format?: "smsto" | "rfc";
}

/** Options for {@link geo}. */
export interface GeoOptions {
	/** Altitude in meters. */
	altitude?: number;
	/** Uncertainty in meters, emitted as the RFC 5870 `u` parameter. */
	uncertainty?: number;
}

/** Wi-Fi authentication type. */
export type WifiSecurity = "WPA" | "WEP" | "nopass";

/** Options for {@link wifi}. */
export interface WifiOptions {
	/** Network name, 1 to 32 characters. Escaped for you. */
	ssid: string;
	/**
	 * Pre-shared key. Escaped for you. Omit for an open network.
	 *
	 * WPA, WPA2 and WPA3 accept an 8 to 63 character passphrase, or 64 hex
	 * digits for a raw pre-shared key. WEP accepts 5 or 13 characters, or 10 or
	 * 26 hex digits.
	 *
	 * A passphrase that happens to be an even number of hex digits is quoted so
	 * it is read as text. A key at one of the real hex key lengths above is left
	 * bare so it is read as hex.
	 */
	password?: string;
	/**
	 * Authentication type. `"WPA"` covers WPA, WPA2 and WPA3.
	 *
	 * @default "WPA" when a password is given, otherwise "nopass"
	 */
	security?: WifiSecurity;
	/**
	 * Whether the network suppresses its SSID broadcast.
	 *
	 * @default false
	 */
	hidden?: boolean;
}

/** Hash algorithm for a one-time password. */
export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

/** Fields shared by {@link totp} and {@link hotp}. */
export interface OtpOptions {
	/**
	 * Secret key: either unpadded RFC 4648 base32, or the raw bytes to encode.
	 *
	 * A string is uppercased, stripped of spaces and `=` padding, and then
	 * checked, because a secret that is not valid base32 yields an
	 * authenticator that generates permanently wrong codes rather than
	 * reporting an error.
	 */
	secret: string | Uint8Array;
	/** Account the secret belongs to, usually a username or email address. */
	account: string;
	/** Service name shown by the authenticator. */
	issuer?: string;
	/**
	 * Hash algorithm.
	 *
	 * @default "SHA1", and omitted from the URI when it is the default
	 */
	algorithm?: OtpAlgorithm;
	/**
	 * Number of digits in the generated code, 6 or 8.
	 *
	 * @default 6, and omitted from the URI when it is the default
	 */
	digits?: number;
}

/** Options for {@link totp}. */
export interface TotpOptions extends OtpOptions {
	/**
	 * Seconds each code remains valid.
	 *
	 * @default 30, and omitted from the URI when it is the default
	 */
	period?: number;
}

/** Options for {@link hotp}. */
export interface HotpOptions extends OtpOptions {
	/** Initial counter value. Required for HOTP. */
	counter: number;
}

/** A postal address, as used by {@link vcard}. */
export interface Address {
	/** Street, including number. */
	street?: string;
	/** City or locality. */
	city?: string;
	/** State, province or region. */
	region?: string;
	/** Postal or ZIP code. */
	postalCode?: string;
	/** Country name. */
	country?: string;
}

/** Options for {@link vcard} and {@link mecard}. */
export interface ContactOptions {
	/** Given name. */
	firstName?: string;
	/** Family name. */
	lastName?: string;
	/**
	 * Full display name.
	 *
	 * @default the given and family names joined by a space
	 */
	displayName?: string;
	/** Organization or company. */
	organization?: string;
	/** Job title. Ignored by {@link mecard}, which has no field for it. */
	title?: string;
	/** Phone numbers, in the order they should appear. */
	phones?: string[];
	/** Email addresses, in the order they should appear. */
	emails?: string[];
	/** Website URLs. */
	urls?: string[];
	/** Free-form note. */
	note?: string;
	/** Birthday. Only the calendar date is used. */
	birthday?: Date;
	/** Postal address. {@link mecard} uses only a single flattened line. */
	address?: Address;
}

/** Options for {@link event}. */
export interface EventOptions {
	/** Event title. */
	title: string;
	/** When the event begins. */
	start: Date;
	/** When the event ends. Omit for an event with no stated end. */
	end?: Date;
	/**
	 * Treat the event as all-day, emitting dates without a time.
	 *
	 * @default false
	 */
	allDay?: boolean;
	/** Where the event takes place. */
	location?: string;
	/** Longer description. */
	description?: string;
}

/** RFC 4648 base32 alphabet, without padding. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes bytes as unpadded uppercase base32.
 *
 * @param bytes - The key material to encode.
 * @returns The base32 text, with no `=` padding.
 */
function toBase32(bytes: Uint8Array): string {
	let value = 0;
	let bits = 0;
	let out = "";

	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}

	// A trailing partial group is padded with zero bits, not with "=".
	if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];

	return out;
}

/**
 * Normalizes and checks a one-time password secret.
 *
 * @param secret - Base32 text, or raw bytes to encode.
 * @returns Unpadded uppercase base32.
 * @throws {RangeError} when a string is empty or is not valid base32.
 */
function normalizeSecret(secret: string | Uint8Array): string {
	if (typeof secret !== "string") {
		if (secret.length === 0) throw new RangeError("secret cannot be empty.");
		return toBase32(secret);
	}

	const cleaned = secret.replace(/[\s=]/g, "").toUpperCase();
	if (cleaned.length === 0) throw new RangeError("secret cannot be empty.");
	if (!/^[A-Z2-7]+$/.test(cleaned)) {
		throw new RangeError("secret must be base32 (letters A-Z and digits 2-7), or a Uint8Array of raw key bytes.");
	}

	return cleaned;
}

/**
 * Percent-encodes an email address, leaving `@` readable.
 *
 * RFC 6068 permits a literal `@` in a `mailto:` address, and keeping it saves
 * two characters over `%40` in every address.
 *
 * @param address - The address to encode.
 * @returns The encoded address.
 * @throws {RangeError} when the address has no `@`.
 */
function encodeAddress(address: string): string {
	const trimmed = address.trim();
	if (!trimmed.includes("@")) throw new RangeError(`"${address}" is not an email address.`);
	return encodeURIComponent(trimmed).replace(/%40/g, "@");
}

/**
 * Joins one or many recipients into a comma-separated encoded list.
 *
 * @param value - A single address or a list of them.
 * @returns The encoded list.
 * @throws {RangeError} when the list is empty or an address has no `@`.
 */
function encodeAddresses(value: string | string[]): string {
	const list = (Array.isArray(value) ? value : [value]).filter((entry) => entry.trim().length > 0);
	if (list.length === 0) throw new RangeError("at least one recipient is required.");
	return list.map(encodeAddress).join(",");
}

/**
 * Whether a host may be safely uppercased.
 *
 * @param host - The host portion of a URL, without userinfo or port.
 * @returns True for a plain ASCII domain that is not punycode. IPv6 literals,
 * internationalized hosts and `xn--` labels all return false, the last because
 * RFC 3492 gives case meaning inside a punycode label.
 */
function foldableHost(host: string): boolean {
	if (!/^[A-Za-z0-9.-]+$/.test(host)) return false;
	return !host.split(".").some((label) => /^xn--/i.test(label));
}

/**
 * Uppercases the scheme and host of a URL, leaving everything else byte for
 * byte as it was.
 *
 * Works on the original text rather than a reserialized {@link URL}, because
 * `URL` normalizes a bare domain by appending a trailing slash and that costs a
 * character the caller did not ask to spend.
 *
 * @param text - The URL to fold.
 * @returns The URL with its case-insensitive parts uppercased.
 */
function foldOrigin(text: string): string {
	const match = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)/.exec(text);
	if (match === null) return text;

	const [whole, scheme = "", authority = ""] = match;

	// Userinfo is case-sensitive, so only what follows the last "@" may fold.
	const at = authority.lastIndexOf("@");
	const userinfo = at === -1 ? "" : authority.slice(0, at + 1);
	let hostport = at === -1 ? authority : authority.slice(at + 1);

	// A trailing ":port" is separate. The bracket check keeps IPv6 literals,
	// which are full of colons, from being mistaken for a port.
	const colon = hostport.lastIndexOf(":");
	let port = "";
	if (colon > hostport.lastIndexOf("]") && /^\d*$/.test(hostport.slice(colon + 1))) {
		port = hostport.slice(colon);
		hostport = hostport.slice(0, colon);
	}

	const host = foldableHost(hostport) ? hostport.toUpperCase() : hostport;
	return `${scheme.toUpperCase()}://${userinfo}${host}${port}${text.slice(whole.length)}`;
}

/**
 * Escapes a value for the `WIFI:` format.
 *
 * @param value - The raw SSID or password.
 * @param hexKeyLengths - Lengths at which a hex-looking value is a genuine hex
 * key for this field, and so must be left bare rather than quoted: 10 and 26
 * for a WEP key, 64 for a raw WPA pre-shared key.
 * @returns The value with `\ ; , : "` backslash-escaped, wrapped in quotes when
 * it would otherwise be misread as hex.
 */
function escapeWifi(value: string, hexKeyLengths: readonly number[] = []): string {
	const escaped = value.replace(/([\\;,:"])/g, "\\$1");

	// A value that is entirely hex digits of even length is read as hex bytes.
	// Text therefore has to be quoted to survive, but a key whose length
	// matches a real hex key form is meant to be read as hex, so it stays bare.
	// A hex-looking value contains nothing that needed escaping, so quoting the
	// escaped form is safe either way.
	const looksHex = /^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0;
	return looksHex && !hexKeyLengths.includes(value.length) ? `"${escaped}"` : escaped;
}

/**
 * Escapes a value for the `MECARD:` format.
 *
 * @param value - The raw field value.
 * @returns The value with `\ ; , :` backslash-escaped and newlines removed,
 * MECARD having no way to represent a line break.
 */
function escapeMecard(value: string): string {
	return value.replace(/\r?\n/g, " ").replace(/([\\;,:])/g, "\\$1");
}

/**
 * Escapes a value for vCard and iCalendar, which share RFC 6350 text rules.
 *
 * @param value - The raw field value.
 * @returns The value with `\`, `;` and `,` backslash-escaped and newlines
 * turned into the literal `\n` escape.
 */
function escapeIcal(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Formats a date as an iCalendar or vCard timestamp.
 *
 * @param date - The moment to format.
 * @param dateOnly - Emit `YYYYMMDD` for an all-day value instead of a UTC
 * `YYYYMMDDTHHMMSSZ` timestamp.
 * @returns The formatted value.
 * @throws {RangeError} when the date is invalid.
 */
function formatDate(date: Date, dateOnly: boolean): string {
	if (Number.isNaN(date.getTime())) throw new RangeError("date is invalid.");
	const iso = date.toISOString();
	const day = iso.slice(0, 10).replace(/-/g, "");
	return dateOnly ? day : `${day}T${iso.slice(11, 19).replace(/:/g, "")}Z`;
}

/**
 * Plain text, unchanged.
 *
 * Text needs no format of its own: a QR code holding a bare string is read as
 * that string. This exists so the payload builders cover every case, and to
 * make it obvious that no escaping is called for.
 *
 * @param value - The text to carry.
 * @returns The same text.
 *
 * @example
 * ```typescript
 * QRCode.encode(text("Table 12"));
 * ```
 */
export function text(value: string): string {
	return value;
}

/**
 * A website address.
 *
 * @param input - The URL, as a string or a {@link URL}. Validated by the `URL`
 * constructor, so it must be absolute and carry a scheme.
 * @param options - Whether to case-fold for a smaller symbol (see
 * {@link UrlOptions}).
 * @returns The URL, by default with its scheme and host uppercased.
 * @throws {TypeError} when the input is not a valid absolute URL.
 *
 * @example Case folding often drops a version
 * ```typescript
 * url("https://rabbit-company.com/"); // "HTTPS://RABBIT-COMPANY.COM/"
 * ```
 *
 * @example Left exactly as given
 * ```typescript
 * url("https://rabbit-company.com/", { compact: false });
 * ```
 */
export function url(input: string | URL, options: UrlOptions = {}): string {
	const value = typeof input === "string" ? input.trim() : input.href;

	// Validate, but keep the caller's text: URL.href would rewrite it.
	new URL(value);

	return options.compact === false ? value : foldOrigin(value);
}

/**
 * An email address, optionally with a prefilled subject and body.
 *
 * @param options - Recipients and message fields (see {@link EmailOptions}).
 * @returns An RFC 6068 `mailto:` URI.
 * @throws {RangeError} when no recipient is given, or an address has no `@`.
 *
 * @example
 * ```typescript
 * email({ to: "info@rabbit-company.com", subject: "Hello & welcome" });
 * // "mailto:info@rabbit-company.com?subject=Hello%20%26%20welcome"
 * ```
 */
export function email(options: EmailOptions): string {
	const headers: string[] = [];
	if (options.cc !== undefined) headers.push(`cc=${encodeAddresses(options.cc)}`);
	if (options.bcc !== undefined) headers.push(`bcc=${encodeAddresses(options.bcc)}`);
	if (options.subject !== undefined) headers.push(`subject=${encodeURIComponent(options.subject)}`);
	if (options.body !== undefined) headers.push(`body=${encodeURIComponent(options.body)}`);

	const query = headers.length === 0 ? "" : `?${headers.join("&")}`;
	return `mailto:${encodeAddresses(options.to)}${query}`;
}

/**
 * A telephone number.
 *
 * @param number - The number to dial. Visual separators (spaces, dots, dashes,
 * brackets) are stripped, since RFC 3966 treats them as decoration. Keep the
 * leading `+` for an international number.
 * @returns An RFC 3966 `tel:` URI.
 * @throws {RangeError} when the number contains no digits.
 *
 * @example
 * ```typescript
 * tel("+386 (1) 234-5678"); // "tel:+38612345678"
 * ```
 */
export function tel(number: string): string {
	const cleaned = number.replace(/[\s().-]/g, "");
	if (!/\d/.test(cleaned)) throw new RangeError(`"${number}" contains no digits.`);
	if (!/^\+?[\d*#,;]+$/.test(cleaned)) throw new RangeError(`"${number}" is not a dialable number.`);
	return `tel:${cleaned}`;
}

/**
 * A text message, optionally prefilled.
 *
 * @param options - Recipient, message and which convention to emit (see
 * {@link SmsOptions}).
 * @returns `SMSTO:number:message` by default, or an RFC 5724 `sms:` URI when
 * `format` is `"rfc"`.
 * @throws {RangeError} when the number is not dialable.
 *
 * @example
 * ```typescript
 * sms({ to: "+38612345678", message: "Table for two" });
 * // "SMSTO:+38612345678:Table for two"
 * ```
 */
export function sms(options: SmsOptions): string {
	const number = tel(options.to).slice("tel:".length);

	if (options.format === "rfc") {
		const query = options.message === undefined ? "" : `?body=${encodeURIComponent(options.message)}`;
		return `sms:${number}${query}`;
	}

	// SMSTO defines no escaping. Parsers split on the first two colons and take
	// the rest verbatim, so a colon in the message is safe but a newline is not.
	const message = options.message === undefined ? "" : `:${options.message.replace(/\r?\n/g, " ")}`;
	return `SMSTO:${number}${message}`;
}

/**
 * A geographic point.
 *
 * @param latitude - Degrees north, -90 to 90.
 * @param longitude - Degrees east, -180 to 180.
 * @param options - Altitude and uncertainty (see {@link GeoOptions}).
 * @returns An RFC 5870 `geo:` URI.
 * @throws {RangeError} when a coordinate is outside its range or is not finite.
 *
 * @example
 * ```typescript
 * geo(46.0569, 14.5058); // "geo:46.0569,14.5058"
 * ```
 */
export function geo(latitude: number, longitude: number, options: GeoOptions = {}): string {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new RangeError("latitude must be a finite number between -90 and 90.");
	}
	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
		throw new RangeError("longitude must be a finite number between -180 and 180.");
	}

	let out = `geo:${latitude},${longitude}`;
	if (options.altitude !== undefined) {
		if (!Number.isFinite(options.altitude)) throw new RangeError("altitude must be a finite number.");
		out += `,${options.altitude}`;
	}
	if (options.uncertainty !== undefined) {
		if (!Number.isFinite(options.uncertainty) || options.uncertainty < 0) {
			throw new RangeError("uncertainty must be a finite, non-negative number.");
		}
		out += `;u=${options.uncertainty}`;
	}

	return out;
}

/**
 * Wi-Fi credentials, so a device can join by scanning.
 *
 * The format escapes `\ ; , : "` with a backslash, which is the rule most
 * hand-written implementations miss: a password containing a semicolon
 * otherwise ends the field early and produces a valid code for the wrong
 * password.
 *
 * @param options - Network name, key and security type (see
 * {@link WifiOptions}).
 * @returns A `WIFI:` payload, terminated with the required double semicolon.
 * @throws {RangeError} when the SSID is empty or over 32 characters, when a
 * password is given for an open network or missing for a secured one, or when a
 * WPA or WEP key is not a valid length.
 *
 * @example A password that would break a naive implementation
 * ```typescript
 * wifi({ ssid: "Cafe; Guest", password: "pa:ss;word" });
 * // "WIFI:T:WPA;S:Cafe\\; Guest;P:pa\\:ss\\;word;;"
 * ```
 *
 * @example An open network
 * ```typescript
 * wifi({ ssid: "Airport Free" }); // "WIFI:T:nopass;S:Airport Free;;"
 * ```
 */
export function wifi(options: WifiOptions): string {
	const security = options.security ?? (options.password === undefined ? "nopass" : "WPA");
	const password = options.password;

	if (options.ssid.length === 0) throw new RangeError("ssid cannot be empty.");
	if (options.ssid.length > 32) throw new RangeError(`ssid is ${options.ssid.length} characters; the maximum is 32.`);

	// Lengths at which a hex-looking key is a real hex key rather than a
	// passphrase that happens to look like one.
	const hexKeyLengths = security === "WEP" ? [10, 26] : [64];

	if (security === "nopass") {
		if (password !== undefined && password.length > 0) {
			throw new RangeError('a password cannot be used with security "nopass".');
		}
	} else if (password === undefined || password.length === 0) {
		throw new RangeError(`security "${security}" requires a password.`);
	} else if (security === "WPA" && (password.length < 8 || password.length > 63) && !/^[0-9A-Fa-f]{64}$/.test(password)) {
		throw new RangeError(`a WPA key is 8 to 63 characters, or 64 hex digits for a raw pre-shared key; this one is ${password.length} characters.`);
	} else if (security === "WEP" && !/^(.{5}|.{13})$/s.test(password) && !/^([0-9A-Fa-f]{10}|[0-9A-Fa-f]{26})$/.test(password)) {
		throw new RangeError("a WEP key is 5 or 13 characters, or 10 or 26 hex digits.");
	}

	const fields = [`T:${security}`, `S:${escapeWifi(options.ssid)}`];
	if (security !== "nopass" && password !== undefined) fields.push(`P:${escapeWifi(password, hexKeyLengths)}`);
	if (options.hidden === true) fields.push("H:true");

	return `WIFI:${fields.join(";")};;`;
}

/**
 * Builds an `otpauth://` URI shared by {@link totp} and {@link hotp}.
 *
 * @param type - `"totp"` or `"hotp"`.
 * @param options - The common one-time password fields.
 * @param extra - Type-specific query parameters, already formatted.
 * @returns The Key Uri Format URI.
 * @throws {RangeError} when the secret, account or digits are invalid.
 */
function otpauth(type: "totp" | "hotp", options: OtpOptions, extra: string[]): string {
	if (options.account.trim().length === 0) throw new RangeError("account cannot be empty.");
	if (options.digits !== undefined && options.digits !== 6 && options.digits !== 8) {
		throw new RangeError("digits must be 6 or 8.");
	}

	// The label is "Issuer:account", and the issuer is repeated as a parameter
	// because authenticators disagree about which one they read.
	const label =
		options.issuer === undefined ? encodeURIComponent(options.account) : `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`;

	const params = [`secret=${normalizeSecret(options.secret)}`];
	if (options.issuer !== undefined) params.push(`issuer=${encodeURIComponent(options.issuer)}`);
	if (options.algorithm !== undefined && options.algorithm !== "SHA1") params.push(`algorithm=${options.algorithm}`);
	if (options.digits !== undefined && options.digits !== 6) params.push(`digits=${options.digits}`);
	params.push(...extra);

	return `otpauth://${type}/${label}?${params.join("&")}`;
}

/**
 * A time-based one-time password secret, for an authenticator app.
 *
 * Defaults that match the specification are left out of the URI, since every
 * character costs symbol space and authenticators assume them anyway.
 *
 * @param options - Secret, account, issuer and code parameters (see
 * {@link TotpOptions}).
 * @returns A Key Uri Format `otpauth://totp/` URI.
 * @throws {RangeError} when the secret is not valid base32, the account is
 * empty, `digits` is not 6 or 8, or `period` is not a positive integer.
 *
 * @example
 * ```typescript
 * totp({ issuer: "Rabbit Company", account: "alice@example.com", secret: "JBSWY3DPEHPK3PXP" });
 * // "otpauth://totp/Rabbit%20Company:alice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Rabbit%20Company"
 * ```
 *
 * @example From raw key bytes
 * ```typescript
 * totp({ account: "alice", secret: crypto.getRandomValues(new Uint8Array(20)) });
 * ```
 */
export function totp(options: TotpOptions): string {
	const extra: string[] = [];
	if (options.period !== undefined) {
		if (!Number.isInteger(options.period) || options.period <= 0) {
			throw new RangeError("period must be a positive integer number of seconds.");
		}
		if (options.period !== 30) extra.push(`period=${options.period}`);
	}
	return otpauth("totp", options, extra);
}

/**
 * A counter-based one-time password secret, for an authenticator app.
 *
 * @param options - Secret, account, issuer and counter (see
 * {@link HotpOptions}).
 * @returns A Key Uri Format `otpauth://hotp/` URI.
 * @throws {RangeError} when the secret is not valid base32, the account is
 * empty, `digits` is not 6 or 8, or `counter` is not a non-negative integer.
 *
 * @example
 * ```typescript
 * hotp({ issuer: "ACME", account: "alice", secret: "JBSWY3DPEHPK3PXP", counter: 0 });
 * ```
 */
export function hotp(options: HotpOptions): string {
	if (!Number.isInteger(options.counter) || options.counter < 0) {
		throw new RangeError("counter must be a non-negative integer.");
	}
	return otpauth("hotp", options, [`counter=${options.counter}`]);
}

/**
 * Contact details as a MECARD.
 *
 * Considerably more compact than {@link vcard}, which matters at QR sizes, and
 * well supported by Android scanners. Prefer {@link vcard} when iOS support or
 * richer fields matter.
 *
 * @param options - The contact fields (see {@link ContactOptions}). `title` has
 * no MECARD equivalent and is ignored.
 * @returns A `MECARD:` payload, terminated with the required double semicolon.
 * @throws {RangeError} when no name, organization, phone or email is given, so
 * the card would carry nothing.
 *
 * @example
 * ```typescript
 * mecard({ firstName: "Alice", lastName: "Smith", phones: ["+38612345678"] });
 * // "MECARD:N:Smith,Alice;TEL:+38612345678;;"
 * ```
 */
export function mecard(options: ContactOptions): string {
	const fields: string[] = [];

	if (options.lastName !== undefined || options.firstName !== undefined) {
		fields.push(`N:${escapeMecard(options.lastName ?? "")},${escapeMecard(options.firstName ?? "")}`);
	}
	for (const phone of options.phones ?? []) fields.push(`TEL:${escapeMecard(phone)}`);
	for (const address of options.emails ?? []) fields.push(`EMAIL:${escapeMecard(address)}`);
	if (options.organization !== undefined) fields.push(`ORG:${escapeMecard(options.organization)}`);
	for (const link of options.urls ?? []) fields.push(`URL:${escapeMecard(link)}`);
	if (options.birthday !== undefined) fields.push(`BDAY:${formatDate(options.birthday, true)}`);
	if (options.address !== undefined) {
		const parts = [options.address.street, options.address.city, options.address.region, options.address.postalCode, options.address.country];
		const line = parts.filter((part) => part !== undefined && part.length > 0).join(" ");
		if (line.length > 0) fields.push(`ADR:${escapeMecard(line)}`);
	}
	if (options.note !== undefined) fields.push(`NOTE:${escapeMecard(options.note)}`);

	if (fields.length === 0) throw new RangeError("a contact needs at least a name, organization, phone or email.");

	return `MECARD:${fields.join(";")};;`;
}

/**
 * Contact details as a vCard 4.0.
 *
 * Larger than {@link mecard} but the actual standard, and the form iOS handles
 * best. Lines are not folded at 75 octets as RFC 6350 asks, because QR readers
 * universally accept unfolded lines and folding would only inflate the symbol.
 *
 * @param options - The contact fields (see {@link ContactOptions}).
 * @returns A `BEGIN:VCARD` block with CRLF line endings, as the RFC requires.
 * @throws {RangeError} when no name, organization, phone or email is given.
 *
 * @example
 * ```typescript
 * vcard({ firstName: "Alice", lastName: "Smith", organization: "Rabbit Company" });
 * ```
 */
export function vcard(options: ContactOptions): string {
	const hasName = options.firstName !== undefined || options.lastName !== undefined || options.displayName !== undefined;
	if (!hasName && options.organization === undefined && (options.phones ?? []).length === 0 && (options.emails ?? []).length === 0) {
		throw new RangeError("a contact needs at least a name, organization, phone or email.");
	}

	const display = options.displayName ?? [options.firstName, options.lastName].filter((part) => part !== undefined && part.length > 0).join(" ");

	const lines = ["BEGIN:VCARD", "VERSION:4.0"];
	// N is family;given;additional;prefix;suffix.
	if (hasName) lines.push(`N:${escapeIcal(options.lastName ?? "")};${escapeIcal(options.firstName ?? "")};;;`);
	if (display.length > 0) lines.push(`FN:${escapeIcal(display)}`);
	if (options.organization !== undefined) lines.push(`ORG:${escapeIcal(options.organization)}`);
	if (options.title !== undefined) lines.push(`TITLE:${escapeIcal(options.title)}`);
	for (const phone of options.phones ?? []) lines.push(`TEL:${escapeIcal(phone)}`);
	for (const address of options.emails ?? []) lines.push(`EMAIL:${escapeIcal(address)}`);
	for (const link of options.urls ?? []) lines.push(`URL:${escapeIcal(link)}`);
	if (options.birthday !== undefined) lines.push(`BDAY:${formatDate(options.birthday, true)}`);
	if (options.address !== undefined) {
		const { street = "", city = "", region = "", postalCode = "", country = "" } = options.address;
		// ADR is pobox;extended;street;locality;region;code;country.
		lines.push(`ADR:;;${escapeIcal(street)};${escapeIcal(city)};${escapeIcal(region)};${escapeIcal(postalCode)};${escapeIcal(country)}`);
	}
	if (options.note !== undefined) lines.push(`NOTE:${escapeIcal(options.note)}`);
	lines.push("END:VCARD");

	return lines.join("\r\n");
}

/**
 * A calendar event.
 *
 * Emits a bare `VEVENT` rather than a full `VCALENDAR`, which is what QR
 * scanners parse and saves the wrapper's bytes.
 *
 * @param options - Title, times and details (see {@link EventOptions}).
 * @returns A `BEGIN:VEVENT` block with CRLF line endings.
 * @throws {RangeError} when the title is empty, a date is invalid, or the end
 * falls before the start.
 *
 * @example
 * ```typescript
 * event({
 *   title: "Launch",
 *   start: new Date("2026-09-08T10:00:00Z"),
 *   end: new Date("2026-09-08T11:00:00Z"),
 * });
 * ```
 */
export function event(options: EventOptions): string {
	if (options.title.trim().length === 0) throw new RangeError("title cannot be empty.");

	const allDay = options.allDay === true;
	const start = formatDate(options.start, allDay);

	if (options.end !== undefined && options.end.getTime() < options.start.getTime()) {
		throw new RangeError("end cannot fall before start.");
	}

	const lines = ["BEGIN:VEVENT", `SUMMARY:${escapeIcal(options.title)}`];
	lines.push(allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`);
	if (options.end !== undefined) {
		const end = formatDate(options.end, allDay);
		lines.push(allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`);
	}
	if (options.location !== undefined) lines.push(`LOCATION:${escapeIcal(options.location)}`);
	if (options.description !== undefined) lines.push(`DESCRIPTION:${escapeIcal(options.description)}`);
	lines.push("END:VEVENT");

	return lines.join("\r\n");
}

/** Options shared by the BIP-21 style payment URIs. */
export interface Bip21Options {
	/**
	 * Amount in the currency's main unit, so BTC rather than satoshis.
	 *
	 * Pass a string to control the digits exactly. A number is formatted to
	 * plain decimal notation, because `String(0.00000001)` produces `"1e-8"`
	 * and no wallet parses exponents.
	 */
	amount?: number | string;
	/** Short label for the recipient, usually shown as the payee name. */
	label?: string;
	/** Note attached to the payment request. */
	message?: string;
	/**
	 * Extra query parameters, percent-encoded for you.
	 *
	 * BIP-21 reserves the `req-` prefix for parameters a wallet must understand
	 * or else reject the whole request, so only use that prefix deliberately.
	 */
	params?: Readonly<Record<string, string>>;
}

/** Options for {@link bitcoin}. */
export interface BitcoinOptions extends Bip21Options {
	/**
	 * Uppercase the scheme and a bech32 address to shrink the symbol.
	 *
	 * BIP-173 recommends uppercase bech32 in QR codes for exactly this reason,
	 * and both the scheme and a bech32 address are case-insensitive. A legacy
	 * base58 address is never touched, since its case carries information.
	 *
	 * @default true
	 */
	compact?: boolean;
}

/** Options for {@link ethereum}. */
export interface EthereumOptions {
	/** Recipient address, in `0x` hexadecimal form. */
	to: string;
	/**
	 * Amount in wei.
	 *
	 * A `number` is rejected on purpose. One ether is 10^18 wei, far past
	 * `Number.MAX_SAFE_INTEGER`, so a numeric literal would silently lose
	 * precision. Use a `bigint` or a digit string.
	 */
	value?: bigint | string;
	/** EIP-155 chain id, such as 1 for mainnet or 137 for Polygon. */
	chainId?: number;
	/** Gas limit to suggest to the wallet. */
	gasLimit?: number;
}

/** Options for {@link erc20}. */
export interface Erc20Options {
	/** Address of the token contract. */
	contract: string;
	/** Recipient address. */
	to: string;
	/**
	 * Amount in the token's smallest unit, so 10^6 for one USDC.
	 *
	 * As with {@link EthereumOptions.value}, a `number` is rejected to avoid
	 * silent precision loss.
	 */
	amount: bigint | string;
	/** EIP-155 chain id. */
	chainId?: number;
}

/** Options for {@link solana}. */
export interface SolanaOptions {
	/** Amount in whole tokens, not the smallest unit. */
	amount?: number | string;
	/** Mint address of an SPL token, for a token transfer rather than SOL. */
	splToken?: string;
	/** Account the wallet should include as a reference, for reconciliation. */
	reference?: string;
	/** Payee name shown by the wallet. */
	label?: string;
	/** Note shown by the wallet. */
	message?: string;
	/** Memo recorded on chain with the transfer. */
	memo?: string;
}

/** Options for {@link monero}. */
export interface MoneroOptions {
	/** Amount in XMR. */
	amount?: number | string;
	/** Payment id to attach to the transaction. */
	paymentId?: string;
	/** Payee name shown by the wallet. */
	recipientName?: string;
	/** Note shown by the wallet. */
	description?: string;
}

/** Bech32 data characters, which exclude `1`, `b`, `i` and `o`. */
const BECH32_DATA = "[qpzry9x8gf2tvdw0s3jn54khce6mua7l]";

/** A bech32 or bech32m Bitcoin address, such as one starting `bc1`. */
const BITCOIN_BECH32 = new RegExp(`^(bc|tb|bcrt)1${BECH32_DATA}{6,87}$`, "i");

/** A legacy base58 Bitcoin address, either P2PKH or P2SH. */
const BITCOIN_BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,39}$/;

/** A 20-byte hexadecimal address, as used by Ethereum and compatible chains. */
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** A base58 account address, as used by Solana. */
const BASE58_ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** A standard, integrated or subaddress Monero address. */
const MONERO_ADDRESS = /^[48][0-9A-Za-z]{94,105}$/;

/** A BOLT-11 Lightning invoice, optionally carrying a `lightning:` scheme. */
const LIGHTNING_INVOICE = new RegExp(`^ln(bc|tb|bcrt|sb)[0-9]+[munp]?1${BECH32_DATA}+$`, "i");

/**
 * Formats an amount as plain decimal, never in exponent notation.
 *
 * @param value - Amount in the currency's main unit. A string is validated and
 * passed through so the caller keeps exact control of the digits.
 * @param decimals - Digits the currency subdivides into, 8 for BTC.
 * @param name - Field name to quote in the error.
 * @returns The amount with trailing zeros trimmed.
 * @throws {RangeError} when the value is negative, not finite, or not a plain
 * decimal number.
 */
function decimalAmount(value: number | string, decimals: number, name: string): string {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!/^\d+(\.\d+)?$/.test(trimmed)) {
			throw new RangeError(`${name} must be a plain decimal amount, such as "0.001", not "${value}".`);
		}
		return trimmed;
	}

	if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite, non-negative number.`);

	// toFixed avoids the exponent notation String() produces below 1e-6, which
	// would leave an amount no wallet can read.
	const fixed = value.toFixed(decimals);
	return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/**
 * Validates an integer token amount given in a currency's smallest unit.
 *
 * @param value - A `bigint`, or a string of digits.
 * @param name - Field name to quote in the error.
 * @returns The amount as a digit string.
 * @throws {RangeError} when the value is negative or is not a whole number.
 */
function integerAmount(value: bigint | string, name: string): string {
	if (typeof value === "bigint") {
		if (value < 0n) throw new RangeError(`${name} cannot be negative.`);
		return value.toString();
	}

	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) throw new RangeError(`${name} must be a whole number of the smallest unit, as a bigint or a digit string.`);
	return trimmed;
}

/**
 * Builds the query string shared by the payment URIs.
 *
 * @param entries - Parameter names paired with values, skipping any undefined.
 * @returns The query string including its leading `?`, or an empty string.
 */
function query(entries: readonly (readonly [string, string | undefined])[]): string {
	const parts = entries.filter((entry): entry is [string, string] => entry[1] !== undefined).map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
	return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

/**
 * Checks a hexadecimal address without verifying its checksum.
 *
 * @param address - The address to check.
 * @param name - Field name to quote in the error.
 * @returns The address unchanged, with its case preserved because EIP-55
 * encodes the checksum in the mix of upper and lower case letters.
 * @throws {RangeError} when the address is not 20 hexadecimal bytes.
 */
function hexAddress(address: string, name: string): string {
	const trimmed = address.trim();
	if (!HEX_ADDRESS.test(trimmed)) throw new RangeError(`${name} must be a 0x-prefixed 40 character hexadecimal address.`);
	return trimmed;
}

/**
 * A payment request in the BIP-21 URI scheme, for any currency that uses it.
 *
 * Bitcoin, Litecoin, Dogecoin, Dash and others share this shape, differing
 * only in the scheme name. Use {@link bitcoin} for Bitcoin, which additionally
 * shrinks the symbol for bech32 addresses.
 *
 * @param scheme - URI scheme without the colon, such as `"litecoin"`.
 * @param address - Recipient address, passed through unchanged because address
 * formats differ per currency and their case can be significant.
 * @param options - Amount and labels (see {@link Bip21Options}).
 * @returns A BIP-21 URI.
 * @throws {RangeError} when the scheme or address is malformed, or the amount
 * is not a plain decimal number.
 *
 * @example
 * ```typescript
 * bip21("litecoin", "ltc1qxyz", { amount: 1.5, label: "Rabbit Company" });
 * ```
 */
export function bip21(scheme: string, address: string, options: Bip21Options = {}): string {
	if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new RangeError(`"${scheme}" is not a valid URI scheme.`);

	const recipient = address.trim();
	if (recipient.length === 0) throw new RangeError("address cannot be empty.");
	if (/[\s?#&]/.test(recipient)) throw new RangeError(`"${address}" is not a valid address.`);

	const extra = Object.entries(options.params ?? {}).map(([key, value]) => [key, value] as const);

	return (
		`${scheme}:${recipient}` +
		query([
			["amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 8, "amount")],
			["label", options.label],
			["message", options.message],
			...extra,
		])
	);
}

/**
 * A Bitcoin payment request.
 *
 * @param address - Recipient address, either bech32 (`bc1...`) or legacy
 * base58. Checked for shape only, not for a valid checksum.
 * @param options - Amount, labels and case folding (see
 * {@link BitcoinOptions}). The amount is in BTC, not satoshis.
 * @returns A BIP-21 `bitcoin:` URI.
 * @throws {RangeError} when the address is not a recognized Bitcoin form, or
 * the amount is not a plain decimal number.
 *
 * @example A request for one milli-bitcoin
 * ```typescript
 * bitcoin("bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d", { amount: 0.001 });
 * // "BITCOIN:bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d?amount=0.001"
 * ```
 *
 * @example One satoshi, which plain number formatting would ruin
 * ```typescript
 * bitcoin("bc1qjcj60rdve5nys72fy42f4yv6s8t34s7x3nh03d", { amount: 0.00000001 });
 * // amount=0.00000001, never "1e-8"
 * ```
 */
export function bitcoin(address: string, options: BitcoinOptions = {}): string {
	const trimmed = address.trim();
	const isBech32 = BITCOIN_BECH32.test(trimmed);

	if (!isBech32 && !BITCOIN_BASE58.test(trimmed)) {
		throw new RangeError(`"${address}" is not a recognized Bitcoin address. Expected a bech32 address such as bc1... or a legacy base58 address.`);
	}

	// Only bech32 may be folded. A base58 address encodes data in its case.
	const fold = options.compact !== false && isBech32;
	const uri = bip21(fold ? "BITCOIN" : "bitcoin", fold ? trimmed.toUpperCase() : trimmed, options);
	return uri;
}

/**
 * An Ethereum payment request in the EIP-681 URI scheme.
 *
 * @param options - Recipient, value in wei and chain (see
 * {@link EthereumOptions}).
 * @returns An EIP-681 `ethereum:` URI.
 * @throws {RangeError} when the address is malformed, the value is not a whole
 * number, or the chain id or gas limit is not a positive integer.
 *
 * @example
 * ```typescript
 * ethereum({ to: "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7", value: 10n ** 18n });
 * // "ethereum:0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7?value=1000000000000000000"
 * ```
 *
 * @example Pinned to Polygon
 * ```typescript
 * ethereum({ to: "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7", chainId: 137 });
 * ```
 */
export function ethereum(options: EthereumOptions): string {
	const to = hexAddress(options.to, "to");
	const chain = options.chainId === undefined ? "" : `@${positiveInteger(options.chainId, "chainId")}`;

	return (
		`ethereum:${to}${chain}` +
		query([
			["value", options.value === undefined ? undefined : integerAmount(options.value, "value")],
			["gasLimit", options.gasLimit === undefined ? undefined : String(positiveInteger(options.gasLimit, "gasLimit"))],
		])
	);
}

/**
 * An ERC-20 token transfer request in the EIP-681 URI scheme.
 *
 * The URI targets the token contract rather than the recipient, with the
 * recipient carried as a function argument, which is what EIP-681 specifies
 * for a `transfer` call.
 *
 * @param options - Token contract, recipient and amount (see
 * {@link Erc20Options}).
 * @returns An EIP-681 `ethereum:` URI calling `transfer`.
 * @throws {RangeError} when an address is malformed, the amount is not a whole
 * number, or the chain id is not a positive integer.
 *
 * @example One USDC, which has six decimals
 * ```typescript
 * erc20({
 *   contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *   to: "0xa4B2b80A4d5C577e1Ddb41096c2BD85D4A6e0bb7",
 *   amount: 1_000_000n,
 * });
 * ```
 */
export function erc20(options: Erc20Options): string {
	const contract = hexAddress(options.contract, "contract");
	const to = hexAddress(options.to, "to");
	const chain = options.chainId === undefined ? "" : `@${positiveInteger(options.chainId, "chainId")}`;

	return `ethereum:${contract}${chain}/transfer${query([
		["address", to],
		["uint256", integerAmount(options.amount, "amount")],
	])}`;
}

/**
 * A Solana Pay transfer request.
 *
 * @param recipient - Recipient account, as a base58 address.
 * @param options - Amount, token and labels (see {@link SolanaOptions}). The
 * amount is in whole tokens, which the wallet scales by the mint's decimals.
 * @returns A Solana Pay `solana:` URI.
 * @throws {RangeError} when an address is not valid base58, or the amount is
 * not a plain decimal number.
 *
 * @example
 * ```typescript
 * solana("HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH", { amount: 0.5, label: "Rabbit Company" });
 * ```
 */
export function solana(recipient: string, options: SolanaOptions = {}): string {
	const to = recipient.trim();
	if (!BASE58_ACCOUNT.test(to)) throw new RangeError(`"${recipient}" is not a valid Solana account address.`);

	if (options.splToken !== undefined && !BASE58_ACCOUNT.test(options.splToken.trim())) {
		throw new RangeError(`"${options.splToken}" is not a valid SPL token mint address.`);
	}
	if (options.reference !== undefined && !BASE58_ACCOUNT.test(options.reference.trim())) {
		throw new RangeError(`"${options.reference}" is not a valid reference account address.`);
	}

	return (
		`solana:${to}` +
		query([
			// Solana mints carry up to nine decimals.
			["amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 9, "amount")],
			["spl-token", options.splToken?.trim()],
			["reference", options.reference?.trim()],
			["label", options.label],
			["message", options.message],
			["memo", options.memo],
		])
	);
}

/**
 * A Monero payment request.
 *
 * Monero names its parameters differently from BIP-21, using `tx_amount` and
 * `tx_payment_id` where other currencies use `amount`.
 *
 * @param address - Recipient address, standard, integrated or a subaddress.
 * @param options - Amount and labels (see {@link MoneroOptions}).
 * @returns A `monero:` URI.
 * @throws {RangeError} when the address is not a recognized Monero form, or
 * the amount is not a plain decimal number.
 *
 * @example
 * ```typescript
 * const address =
 *   "4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge";
 *
 * monero(address, { amount: 0.25, recipientName: "Rabbit Company" });
 * ```
 */
export function monero(address: string, options: MoneroOptions = {}): string {
	const to = address.trim();
	if (!MONERO_ADDRESS.test(to)) throw new RangeError(`"${address}" is not a recognized Monero address.`);

	return (
		`monero:${to}` +
		query([
			// XMR subdivides into twelve decimals.
			["tx_amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 12, "amount")],
			["tx_payment_id", options.paymentId],
			["recipient_name", options.recipientName],
			["tx_description", options.description],
		])
	);
}

/**
 * A Lightning Network invoice.
 *
 * BOLT-11 invoices are bech32, so like a bech32 Bitcoin address they are
 * uppercased for the QR code, which lets the symbol use alphanumeric mode.
 *
 * @param invoice - A BOLT-11 invoice, with or without a `lightning:` prefix.
 * @param options - Pass `{ compact: false }` to keep the invoice as supplied.
 * @returns A `LIGHTNING:` URI.
 * @throws {RangeError} when the invoice is not a recognized BOLT-11 string.
 *
 * @example
 * ```typescript
 * lightning("lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq");
 * ```
 */
export function lightning(invoice: string, options: { compact?: boolean } = {}): string {
	const trimmed = invoice.trim().replace(/^lightning:/i, "");
	if (!LIGHTNING_INVOICE.test(trimmed)) throw new RangeError(`"${invoice}" is not a recognized BOLT-11 Lightning invoice.`);

	return options.compact === false ? `lightning:${trimmed}` : `LIGHTNING:${trimmed.toUpperCase()}`;
}

/**
 * Checks that a value is a positive integer.
 *
 * @param value - The number to check.
 * @param name - Field name to quote in the error.
 * @returns The value unchanged.
 * @throws {RangeError} when the value is not a positive integer.
 */
function positiveInteger(value: number, name: string): number {
	if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer.`);
	return value;
}

/** Options for {@link upi}. */
export interface UpiOptions {
	/** Payee virtual payment address, such as `"merchant@bank"`. */
	payeeAddress: string;
	/** Payee name, shown by the paying app. */
	payeeName: string;
	/** Amount in rupees. */
	amount?: number | string;
	/** Smallest amount the payer may send, for an open request. */
	minimumAmount?: number | string;
	/** Note shown with the request, at most 50 characters. */
	note?: string;
	/** Reference id used to reconcile the payment. */
	reference?: string;
	/** Transaction id, usually set by a payment gateway. */
	transactionId?: string;
	/** Four digit merchant category code. */
	merchantCode?: string;
}

/** Options for {@link epc}. */
export interface EpcOptions {
	/** Beneficiary name, at most 70 characters. */
	name: string;
	/** Beneficiary IBAN, checked with the mod-97 checksum. */
	iban: string;
	/** Beneficiary BIC. Required by version `"001"` and optional in `"002"`. */
	bic?: string;
	/** Amount in euro, from 0.01 to 999999999.99. Omit for an open amount. */
	amount?: number | string;
	/** Four letter SEPA purpose code. */
	purpose?: string;
	/**
	 * Structured creditor reference.
	 *
	 * The standard allows either this or {@link EpcOptions.remittance}, never
	 * both, because they occupy alternative lines of the same block.
	 */
	reference?: string;
	/** Unstructured remittance text, at most 140 characters. */
	remittance?: string;
	/** Beneficiary to originator information, at most 70 characters. */
	information?: string;
	/**
	 * Specification version.
	 *
	 * @default "002", which makes the BIC optional
	 */
	version?: "001" | "002";
}

/** Options for {@link gs1}. */
export interface Gs1Options {
	/** GTIN of 8, 12, 13 or 14 digits. The check digit is verified. */
	gtin: string;
	/** Consumer product variant, GS1 application identifier 22. */
	cpv?: string;
	/** Batch or lot number, application identifier 10. */
	lot?: string;
	/** Serial number, application identifier 21. */
	serial?: string;
	/**
	 * Further data attributes keyed by application identifier, such as
	 * `{ "17": "251231" }` for an expiry date.
	 */
	attributes?: Readonly<Record<string, string>>;
	/**
	 * Resolver the link points at.
	 *
	 * @default "https://id.gs1.org"
	 */
	domain?: string;
}

/** Options for {@link pix}. */
export interface PixOptions {
	/** PIX key: a CPF, CNPJ, phone number, email address or random UUID. */
	key: string;
	/** Merchant name, at most 25 characters. */
	name: string;
	/** Merchant city, at most 15 characters. */
	city: string;
	/** Amount in reais. Omit to let the payer choose. */
	amount?: number | string;
	/**
	 * Reference label for reconciliation, at most 25 characters.
	 *
	 * @default "***", the value the standard uses to mean no reference
	 */
	reference?: string;
	/** Description shown alongside the key. */
	description?: string;
	/**
	 * Mark the code as single use, so a wallet refuses to pay it twice.
	 *
	 * @default false
	 */
	oneTime?: boolean;
	/**
	 * Four digit merchant category code.
	 *
	 * @default "0000", meaning unspecified
	 */
	merchantCategoryCode?: string;
}

/**
 * A virtual payment address, as used by UPI.
 *
 * Deliberately permissive about the length of either side, since NPCI
 * publishes no minimum and refusing a valid address would block a real
 * payment, while the paying app validates the address regardless.
 */
const UPI_VPA = /^[A-Za-z0-9.\-_]{1,256}@[A-Za-z][A-Za-z0-9.\-_]{0,63}$/;

/** An IBAN, before the mod-97 checksum is applied. */
const IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;

/** A BIC of either 8 or 11 characters. */
const BIC_SHAPE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** Largest EPC payload the standard permits, in bytes. */
const EPC_MAX_BYTES = 331;

/**
 * Computes the CRC-16/CCITT-FALSE checksum used by the EMV QR standards.
 *
 * Polynomial 0x1021, initial value 0xFFFF, with neither input nor output
 * reflected and no final exclusive or. Its published check value is 0x29B1 for
 * the string "123456789".
 *
 * @param text - The payload to checksum, including the trailing `6304` tag.
 * @returns Four uppercase hexadecimal digits.
 */
function crc16(text: string): string {
	let crc = 0xffff;

	for (let i = 0; i < text.length; i++) {
		crc ^= text.charCodeAt(i) << 8;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
	}

	return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Encodes one EMV tag-length-value field.
 *
 * @param id - Two digit field identifier.
 * @param value - Field contents.
 * @returns The identifier, the two digit length, then the value.
 * @throws {RangeError} when the value is longer than the two digit length can
 * express.
 */
function tlv(id: string, value: string): string {
	if (value.length > 99) throw new RangeError(`field ${id} is ${value.length} characters, and the format allows at most 99.`);
	return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * Computes the GS1 mod-10 check digit of a numeric body.
 *
 * @param body - The digits preceding the check digit.
 * @returns The check digit, weighting alternate digits by three from the right.
 */
function mod10CheckDigit(body: string): number {
	let sum = 0;
	let weight = 3;
	for (let i = body.length - 1; i >= 0; i--) {
		sum += Number(body[i]) * weight;
		weight = weight === 3 ? 1 : 3;
	}
	return (10 - (sum % 10)) % 10;
}

/**
 * Verifies an IBAN's mod-97 checksum.
 *
 * The first four characters move to the end, letters become their position in
 * the alphabet plus nine, and the resulting number leaves a remainder of one.
 *
 * @param iban - The IBAN, already stripped of spaces and uppercased.
 * @returns True when the checksum holds.
 */
function ibanChecksumValid(iban: string): boolean {
	const rearranged = iban.slice(4) + iban.slice(0, 4);
	let remainder = 0;

	for (const char of rearranged) {
		const digits = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
		for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
	}

	return remainder === 1;
}

/**
 * Checks a field's length.
 *
 * @param value - The text to check.
 * @param max - Longest length the format allows.
 * @param name - Field name to quote in the error.
 * @returns The text unchanged.
 * @throws {RangeError} when the text is empty or too long.
 */
function limited(value: string, max: number, name: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) throw new RangeError(`${name} cannot be empty.`);
	if (trimmed.length > max) throw new RangeError(`${name} is ${trimmed.length} characters, and the format allows at most ${max}.`);
	return trimmed;
}

/**
 * A Unified Payments Interface request, as used in India.
 *
 * @param options - Payee, amount and reference fields (see
 * {@link UpiOptions}).
 * @returns A `upi://pay` URI.
 * @throws {RangeError} when the payee address is not a valid virtual payment
 * address, a field is too long, or an amount is not a plain decimal number.
 *
 * @example
 * ```typescript
 * upi({ payeeAddress: "merchant@bank", payeeName: "Rabbit Company", amount: 250.5 });
 * // "upi://pay?pa=merchant%40bank&pn=Rabbit%20Company&am=250.5&cu=INR"
 * ```
 */
export function upi(options: UpiOptions): string {
	const address = options.payeeAddress.trim();
	if (!UPI_VPA.test(address)) {
		throw new RangeError(`"${options.payeeAddress}" is not a valid virtual payment address. Expected a form like "name@bank".`);
	}

	if (options.merchantCode !== undefined && !/^\d{4}$/.test(options.merchantCode)) {
		throw new RangeError("merchantCode must be four digits.");
	}

	return (
		"upi://pay" +
		query([
			["pa", address],
			["pn", limited(options.payeeName, 99, "payeeName")],
			// Rupees subdivide into paise, so two decimals.
			["am", options.amount === undefined ? undefined : decimalAmount(options.amount, 2, "amount")],
			["mam", options.minimumAmount === undefined ? undefined : decimalAmount(options.minimumAmount, 2, "minimumAmount")],
			// UPI settles only in rupees, so the currency is never anything else.
			["cu", "INR"],
			["tn", options.note === undefined ? undefined : limited(options.note, 50, "note")],
			["tr", options.reference],
			["tid", options.transactionId],
			["mc", options.merchantCode],
		])
	);
}

/**
 * A SEPA credit transfer request in the EPC QR format, also called a GiroCode.
 *
 * The payload is a block of newline separated lines at fixed positions rather
 * than a URI, and the whole thing must fit in 331 bytes.
 *
 * @param options - Beneficiary, amount and remittance fields (see
 * {@link EpcOptions}).
 * @returns An EPC069-12 payload with newline separators.
 * @throws {RangeError} when the IBAN fails its checksum, a BIC is missing for
 * version `"001"`, both a structured reference and unstructured remittance are
 * given, a field is too long, or the payload exceeds 331 bytes.
 *
 * @example
 * ```typescript
 * epc({
 *   name: "Rabbit Company",
 *   iban: "DE89370400440532013000",
 *   amount: 12.5,
 *   remittance: "Invoice 2026-014",
 * });
 * ```
 */
export function epc(options: EpcOptions): string {
	const version = options.version ?? "002";

	const iban = options.iban.replace(/\s+/g, "").toUpperCase();
	if (!IBAN_SHAPE.test(iban) || !ibanChecksumValid(iban)) {
		throw new RangeError(`"${options.iban}" is not a valid IBAN. The mod-97 checksum does not hold.`);
	}

	const bic = options.bic === undefined ? "" : options.bic.replace(/\s+/g, "").toUpperCase();
	if (bic !== "" && !BIC_SHAPE.test(bic)) throw new RangeError(`"${options.bic}" is not a valid BIC.`);
	if (version === "001" && bic === "") throw new RangeError('version "001" requires a bic. Use version "002" to omit it.');

	if (options.reference !== undefined && options.remittance !== undefined) {
		throw new RangeError("give either reference or remittance, not both. The standard puts them on alternative lines.");
	}
	if (options.purpose !== undefined && !/^[A-Za-z]{4}$/.test(options.purpose)) {
		throw new RangeError("purpose must be a four letter SEPA code.");
	}

	let amount = "";
	if (options.amount !== undefined) {
		const value = decimalAmount(options.amount, 2, "amount");
		if (Number(value) < 0.01 || Number(value) > 999999999.99) {
			throw new RangeError("amount must be between 0.01 and 999999999.99 euro.");
		}
		amount = `EUR${value}`;
	}

	const lines = [
		"BCD",
		version,
		// 1 selects UTF-8 from the standard's list of character sets.
		"1",
		"SCT",
		bic,
		limited(options.name, 70, "name"),
		iban,
		amount,
		options.purpose === undefined ? "" : options.purpose.toUpperCase(),
		options.reference === undefined ? "" : limited(options.reference, 35, "reference"),
		options.remittance === undefined ? "" : limited(options.remittance, 140, "remittance"),
		options.information === undefined ? "" : limited(options.information, 70, "information"),
	];

	// Trailing empty lines carry no meaning and the standard allows dropping
	// them, which buys room against the byte limit.
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

	const payload = lines.join("\n");
	const bytes = new TextEncoder().encode(payload).length;
	if (bytes > EPC_MAX_BYTES) {
		throw new RangeError(`the payload is ${bytes} bytes, and the standard allows at most ${EPC_MAX_BYTES}. Shorten the remittance or name.`);
	}

	return payload;
}

/**
 * A GS1 Digital Link, the URI form of a product identifier.
 *
 * @param options - GTIN, its qualifiers and any data attributes (see
 * {@link Gs1Options}).
 * @returns An HTTPS URI identifying the product.
 * @throws {RangeError} when the GTIN is not 8, 12, 13 or 14 digits, its check
 * digit is wrong, or an application identifier is not numeric.
 *
 * @example A plain product identifier
 * ```typescript
 * gs1({ gtin: "09521234543213" });
 * // "https://id.gs1.org/01/09521234543213"
 * ```
 *
 * @example With a lot, a serial and an expiry date
 * ```typescript
 * gs1({ gtin: "9521234543213", lot: "LOT-A", serial: "S1", attributes: { "17": "251231" } });
 * // "https://id.gs1.org/01/09521234543213/10/LOT-A/21/S1?17=251231"
 * ```
 */
export function gs1(options: Gs1Options): string {
	const digits = options.gtin.replace(/\s+/g, "");
	if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) {
		throw new RangeError(`"${options.gtin}" is not a GTIN. Expected 8, 12, 13 or 14 digits.`);
	}
	if (mod10CheckDigit(digits.slice(0, -1)) !== Number(digits[digits.length - 1])) {
		throw new RangeError(`the check digit of GTIN "${options.gtin}" is wrong.`);
	}

	// Digital Link uses the 14 digit form. Leading zeros do not disturb the
	// check digit, because the weights alternate from the right.
	const gtin = digits.padStart(14, "0");

	const domain = (options.domain ?? "https://id.gs1.org").replace(/\/+$/, "");

	// Qualifiers have to appear in this order to be a conformant link.
	const path = [
		["01", gtin],
		["22", options.cpv],
		["10", options.lot],
		["21", options.serial],
	]
		.filter((entry): entry is [string, string] => entry[1] !== undefined)
		.map(([ai, value]) => `${ai}/${encodeURIComponent(value)}`)
		.join("/");

	const attributes = Object.entries(options.attributes ?? {});
	for (const [ai] of attributes) {
		if (!/^\d{2,4}$/.test(ai)) throw new RangeError(`"${ai}" is not a GS1 application identifier.`);
	}

	return `${domain}/${path}${query(attributes.map(([ai, value]) => [ai, value] as const))}`;
}

/**
 * A PIX payment request, as used in Brazil.
 *
 * PIX follows the EMV merchant-presented QR standard, so the payload is a
 * chain of tag-length-value fields ending in a CRC-16 checksum rather than a
 * URI. A single wrong length byte invalidates the whole code.
 *
 * @param options - Key, merchant details and amount (see {@link PixOptions}).
 * @returns The EMV payload, ending with its `6304` checksum field.
 * @throws {RangeError} when a field is empty or too long, the merchant
 * category code is not four digits, or the amount is not a plain decimal
 * number.
 *
 * @example
 * ```typescript
 * pix({
 *   key: "alice@example.com",
 *   name: "Rabbit Company",
 *   city: "SAO PAULO",
 *   amount: 10.5,
 *   reference: "ORDER7",
 * });
 * ```
 */
export function pix(options: PixOptions): string {
	const code = options.merchantCategoryCode ?? "0000";
	if (!/^\d{4}$/.test(code)) throw new RangeError("merchantCategoryCode must be four digits.");

	const account =
		tlv("00", "br.gov.bcb.pix") +
		tlv("01", limited(options.key, 77, "key")) +
		(options.description === undefined ? "" : tlv("02", limited(options.description, 72, "description")));

	const body =
		tlv("00", "01") +
		(options.oneTime === true ? tlv("01", "12") : "") +
		tlv("26", account) +
		tlv("52", code) +
		// 986 is the ISO 4217 numeric code for the real.
		tlv("53", "986") +
		(options.amount === undefined ? "" : tlv("54", decimalAmount(options.amount, 2, "amount"))) +
		tlv("58", "BR") +
		tlv("59", limited(options.name, 25, "name")) +
		tlv("60", limited(options.city, 15, "city")) +
		// "***" is the standard's placeholder for "no reference".
		tlv("62", tlv("05", options.reference === undefined ? "***" : limited(options.reference, 25, "reference")));

	// The checksum covers the payload including the "6304" tag and length that
	// introduce it, but not the four digits it produces.
	const withTag = `${body}6304`;
	return withTag + crc16(withTag);
}

/** Options for {@link upn}. */
export interface UpnOptions {
	/** Recipient IBAN, checked with the mod-97 checksum. */
	recipientIban: string;
	/** Recipient name, at most 33 characters. */
	recipientName: string;
	/** Recipient street and number, at most 33 characters. */
	recipientStreet?: string;
	/** Recipient postcode and town, at most 33 characters. */
	recipientCity?: string;
	/**
	 * Recipient reference, at most 26 characters.
	 *
	 * @default "SI99", which the standard uses to mean no reference
	 */
	recipientReference?: string;
	/** Amount in euro. Omit to let the payer enter it. */
	amount?: number | string;
	/**
	 * ISO 20022 purpose code, four letters.
	 *
	 * @default "OTHR"
	 */
	purposeCode?: string;
	/** Purpose text shown to the payer, at most 42 characters. */
	purpose?: string;
	/** Date the payment falls due. */
	dueDate?: Date;
	/** Payer IBAN, at most 19 characters. */
	payerIban?: string;
	/** Payer reference, at most 26 characters. */
	payerReference?: string;
	/** Payer name, at most 33 characters. */
	payerName?: string;
	/** Payer street and number, at most 33 characters. */
	payerStreet?: string;
	/** Payer postcode and town, at most 33 characters. */
	payerCity?: string;
	/**
	 * Flag the transfer as urgent.
	 *
	 * @default false
	 */
	urgent?: boolean;
}

/**
 * Characters ISO-8859-2 maps to bytes 0xA0 through 0xFF.
 *
 * Taken from the platform's own `iso-8859-2` decoder rather than transcribed,
 * so it cannot drift from the standard.
 */
const LATIN2_HIGH = " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ" + "°ą˛ł´ľśˇ¸šşťź˝žż" + "ŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎ" + "ĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢß" + "ŕáâăäĺćçčéęëěíîď" + "đńňóôőö÷řůúűüýţ˙";

/** A Slovenian or ISO 11649 payment reference. */
const UPN_REFERENCE = /^(SI\d{2}|RF\d{2})[0-9\-]{0,22}$/;

/**
 * Encodes text as ISO-8859-2, the character set UPN QR requires.
 *
 * The library encodes text as UTF-8, where `č` occupies two bytes. A UPN QR
 * carrying UTF-8 therefore shows mojibake in a bank application and reports
 * the wrong length, so a Slovenian payment order has to be encoded with
 * {@link https://jsr.io/@rabbit-company/qrcode/doc/~/QRCode.encodeBinary | QRCode.encodeBinary}
 * over these bytes instead.
 *
 * @param value - The text to encode.
 * @returns One byte per character.
 * @throws {RangeError} when a character has no ISO-8859-2 representation,
 * naming the character, since silently substituting it would corrupt a payment
 * instruction.
 *
 * @example
 * ```typescript
 * QRCode.encodeBinary(latin2(upn({ recipientIban, recipientName, amount: 12.5 })));
 * ```
 */
export function latin2(value: string): Uint8Array {
	const bytes = new Uint8Array(value.length);

	for (let i = 0; i < value.length; i++) {
		const point = value.codePointAt(i) as number;
		if (point < 0x80) {
			bytes[i] = point;
			continue;
		}
		const high = LATIN2_HIGH.indexOf(value[i] as string);
		if (high === -1) {
			throw new RangeError(`"${value[i]}" has no ISO-8859-2 representation, which UPN QR requires. Replace it with a Latin-2 character.`);
		}
		bytes[i] = 0xa0 + high;
	}

	return bytes;
}

/**
 * A Slovenian universal payment order, the `UPNQR` format.
 *
 * This is what Slovenian bank applications read for "skeniraj in placaj".
 * They do not read the EPC QR of {@link epc}, which is an Austrian and German
 * convention, so the two are not interchangeable.
 *
 * The payload is nineteen newline separated fields followed by a three digit
 * control sum, which counts the characters of those fields including their
 * line terminators. The amount is expressed in cents padded to eleven digits,
 * so 12.50 euro becomes `00000001250` rather than `EUR12.50`.
 *
 * Encode the result with {@link latin2} and `QRCode.encodeBinary`, because the
 * format requires ISO-8859-2 rather than UTF-8.
 *
 * The recipient IBAN is checked with the international mod-97 checksum only.
 * That does not prove the account exists, and a Slovenian bank asked to price
 * a transfer to a well-formed but non-existent account reports a tariff error
 * rather than a format error, so test with a real account.
 *
 * @param options - Recipient, amount and payer fields (see {@link UpnOptions}).
 * @returns The `UPNQR` payload, ending with its control sum.
 * @throws {RangeError} when the recipient IBAN fails its checksum, the
 * reference is not a `SI` or `RF` form, a field is too long, or the amount is
 * outside what eleven digits of cents can hold.
 *
 * @example
 * ```typescript
 * const payload = upn({
 *   recipientIban: "SI56263300012039086",
 *   recipientName: "Rabbit Company",
 *   recipientCity: "1000 Ljubljana",
 *   amount: 12.5,
 *   purpose: "Racun 2026-014",
 * });
 *
 * const qr = QRCode.encodeBinary(latin2(payload));
 * ```
 */
export function upn(options: UpnOptions): string {
	const iban = options.recipientIban.replace(/\s+/g, "").toUpperCase();
	if (!IBAN_SHAPE.test(iban) || !ibanChecksumValid(iban)) {
		throw new RangeError(`"${options.recipientIban}" is not a valid IBAN. The mod-97 checksum does not hold.`);
	}

	const reference = (options.recipientReference ?? "SI99").replace(/\s+/g, "").toUpperCase();
	if (!UPN_REFERENCE.test(reference)) {
		throw new RangeError(`"${options.recipientReference}" is not a valid reference. Expected a form like "SI99" or "SI121234567890123".`);
	}

	const purposeCode = (options.purposeCode ?? "OTHR").toUpperCase();
	if (!/^[A-Z]{4}$/.test(purposeCode)) throw new RangeError("purposeCode must be four letters.");

	// The amount travels as cents, zero padded to eleven digits.
	let cents = "0".repeat(11);
	if (options.amount !== undefined) {
		const euro = decimalAmount(options.amount, 2, "amount");
		const value = Math.round(Number(euro) * 100);
		if (value > 99999999999) throw new RangeError("amount is larger than eleven digits of cents can hold.");
		cents = String(value).padStart(11, "0");
	}

	const date = (value: Date | undefined): string => {
		if (value === undefined) return "";
		if (Number.isNaN(value.getTime())) throw new RangeError("dueDate is invalid.");
		const day = String(value.getDate()).padStart(2, "0");
		const month = String(value.getMonth() + 1).padStart(2, "0");
		return `${day}.${month}.${value.getFullYear()}`;
	};

	const capped = (value: string | undefined, max: number, name: string): string => (value === undefined ? "" : limited(value, max, name));

	const fields = [
		"UPNQR",
		capped(options.payerIban, 19, "payerIban"),
		// Deposit and withdrawal are reserved for bank use.
		"",
		"",
		capped(options.payerReference, 26, "payerReference"),
		capped(options.payerName, 33, "payerName"),
		capped(options.payerStreet, 33, "payerStreet"),
		capped(options.payerCity, 33, "payerCity"),
		cents,
		// The payment date is set by the payer, not the request.
		"",
		options.urgent === true ? "X" : "",
		purposeCode,
		capped(options.purpose, 42, "purpose"),
		date(options.dueDate),
		iban,
		reference,
		limited(options.recipientName, 33, "recipientName"),
		capped(options.recipientStreet, 33, "recipientStreet"),
		capped(options.recipientCity, 33, "recipientCity"),
	];

	// The control sum counts every character of the fields above plus the line
	// terminator that follows each of them. The payload ends at the control sum
	// with no further terminator, matching what Slovenian billers emit.
	const body = fields.map((field) => `${field}\n`).join("");
	return `${body}${String(body.length).padStart(3, "0")}`;
}
