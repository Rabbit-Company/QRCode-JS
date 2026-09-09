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
export declare function text(value: string): string;
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
export declare function url(input: string | URL, options?: UrlOptions): string;
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
export declare function email(options: EmailOptions): string;
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
export declare function tel(number: string): string;
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
export declare function sms(options: SmsOptions): string;
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
export declare function geo(latitude: number, longitude: number, options?: GeoOptions): string;
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
export declare function wifi(options: WifiOptions): string;
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
export declare function totp(options: TotpOptions): string;
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
export declare function hotp(options: HotpOptions): string;
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
export declare function mecard(options: ContactOptions): string;
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
export declare function vcard(options: ContactOptions): string;
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
export declare function event(options: EventOptions): string;
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
export declare function bip21(scheme: string, address: string, options?: Bip21Options): string;
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
export declare function bitcoin(address: string, options?: BitcoinOptions): string;
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
export declare function ethereum(options: EthereumOptions): string;
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
export declare function erc20(options: Erc20Options): string;
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
export declare function solana(recipient: string, options?: SolanaOptions): string;
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
export declare function monero(address: string, options?: MoneroOptions): string;
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
export declare function lightning(invoice: string, options?: {
    compact?: boolean;
}): string;
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
export declare function upi(options: UpiOptions): string;
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
export declare function epc(options: EpcOptions): string;
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
export declare function gs1(options: Gs1Options): string;
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
export declare function pix(options: PixOptions): string;
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
export declare function latin2(value: string): Uint8Array;
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
export declare function upn(options: UpnOptions): string;
