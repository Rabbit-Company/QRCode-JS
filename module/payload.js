// src/payload.ts
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes) {
  let value = 0;
  let bits = 0;
  let out = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0)
    out += BASE32_ALPHABET[value << 5 - bits & 31];
  return out;
}
function normalizeSecret(secret) {
  if (typeof secret !== "string") {
    if (secret.length === 0)
      throw new RangeError("secret cannot be empty.");
    return toBase32(secret);
  }
  const cleaned = secret.replace(/[\s=]/g, "").toUpperCase();
  if (cleaned.length === 0)
    throw new RangeError("secret cannot be empty.");
  if (!/^[A-Z2-7]+$/.test(cleaned)) {
    throw new RangeError("secret must be base32 (letters A-Z and digits 2-7), or a Uint8Array of raw key bytes.");
  }
  return cleaned;
}
function encodeAddress(address) {
  const trimmed = address.trim();
  if (!trimmed.includes("@"))
    throw new RangeError(`"${address}" is not an email address.`);
  return encodeURIComponent(trimmed).replace(/%40/g, "@");
}
function encodeAddresses(value) {
  const list = (Array.isArray(value) ? value : [value]).filter((entry) => entry.trim().length > 0);
  if (list.length === 0)
    throw new RangeError("at least one recipient is required.");
  return list.map(encodeAddress).join(",");
}
function foldableHost(host) {
  if (!/^[A-Za-z0-9.-]+$/.test(host))
    return false;
  return !host.split(".").some((label) => /^xn--/i.test(label));
}
function foldOrigin(text) {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)/.exec(text);
  if (match === null)
    return text;
  const [whole, scheme = "", authority = ""] = match;
  const at = authority.lastIndexOf("@");
  const userinfo = at === -1 ? "" : authority.slice(0, at + 1);
  let hostport = at === -1 ? authority : authority.slice(at + 1);
  const colon = hostport.lastIndexOf(":");
  let port = "";
  if (colon > hostport.lastIndexOf("]") && /^\d*$/.test(hostport.slice(colon + 1))) {
    port = hostport.slice(colon);
    hostport = hostport.slice(0, colon);
  }
  const host = foldableHost(hostport) ? hostport.toUpperCase() : hostport;
  return `${scheme.toUpperCase()}://${userinfo}${host}${port}${text.slice(whole.length)}`;
}
function escapeWifi(value, hexKeyLengths = []) {
  const escaped = value.replace(/([\\;,:"])/g, "\\$1");
  const looksHex = /^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0;
  return looksHex && !hexKeyLengths.includes(value.length) ? `"${escaped}"` : escaped;
}
function escapeMecard(value) {
  return value.replace(/\r?\n/g, " ").replace(/([\\;,:])/g, "\\$1");
}
function escapeIcal(value) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function formatDate(date, dateOnly) {
  if (Number.isNaN(date.getTime()))
    throw new RangeError("date is invalid.");
  const iso = date.toISOString();
  const day = iso.slice(0, 10).replace(/-/g, "");
  return dateOnly ? day : `${day}T${iso.slice(11, 19).replace(/:/g, "")}Z`;
}
function text(value) {
  return value;
}
function url(input, options = {}) {
  const value = typeof input === "string" ? input.trim() : input.href;
  new URL(value);
  return options.compact === false ? value : foldOrigin(value);
}
function email(options) {
  const headers = [];
  if (options.cc !== undefined)
    headers.push(`cc=${encodeAddresses(options.cc)}`);
  if (options.bcc !== undefined)
    headers.push(`bcc=${encodeAddresses(options.bcc)}`);
  if (options.subject !== undefined)
    headers.push(`subject=${encodeURIComponent(options.subject)}`);
  if (options.body !== undefined)
    headers.push(`body=${encodeURIComponent(options.body)}`);
  const query = headers.length === 0 ? "" : `?${headers.join("&")}`;
  return `mailto:${encodeAddresses(options.to)}${query}`;
}
function tel(number) {
  const cleaned = number.replace(/[\s().-]/g, "");
  if (!/\d/.test(cleaned))
    throw new RangeError(`"${number}" contains no digits.`);
  if (!/^\+?[\d*#,;]+$/.test(cleaned))
    throw new RangeError(`"${number}" is not a dialable number.`);
  return `tel:${cleaned}`;
}
function sms(options) {
  const number = tel(options.to).slice("tel:".length);
  if (options.format === "rfc") {
    const query = options.message === undefined ? "" : `?body=${encodeURIComponent(options.message)}`;
    return `sms:${number}${query}`;
  }
  const message = options.message === undefined ? "" : `:${options.message.replace(/\r?\n/g, " ")}`;
  return `SMSTO:${number}${message}`;
}
function geo(latitude, longitude, options = {}) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError("latitude must be a finite number between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("longitude must be a finite number between -180 and 180.");
  }
  let out = `geo:${latitude},${longitude}`;
  if (options.altitude !== undefined) {
    if (!Number.isFinite(options.altitude))
      throw new RangeError("altitude must be a finite number.");
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
function wifi(options) {
  const security = options.security ?? (options.password === undefined ? "nopass" : "WPA");
  const password = options.password;
  if (options.ssid.length === 0)
    throw new RangeError("ssid cannot be empty.");
  if (options.ssid.length > 32)
    throw new RangeError(`ssid is ${options.ssid.length} characters; the maximum is 32.`);
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
  if (security !== "nopass" && password !== undefined)
    fields.push(`P:${escapeWifi(password, hexKeyLengths)}`);
  if (options.hidden === true)
    fields.push("H:true");
  return `WIFI:${fields.join(";")};;`;
}
function otpauth(type, options, extra) {
  if (options.account.trim().length === 0)
    throw new RangeError("account cannot be empty.");
  if (options.digits !== undefined && options.digits !== 6 && options.digits !== 8) {
    throw new RangeError("digits must be 6 or 8.");
  }
  const label = options.issuer === undefined ? encodeURIComponent(options.account) : `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`;
  const params = [`secret=${normalizeSecret(options.secret)}`];
  if (options.issuer !== undefined)
    params.push(`issuer=${encodeURIComponent(options.issuer)}`);
  if (options.algorithm !== undefined && options.algorithm !== "SHA1")
    params.push(`algorithm=${options.algorithm}`);
  if (options.digits !== undefined && options.digits !== 6)
    params.push(`digits=${options.digits}`);
  params.push(...extra);
  return `otpauth://${type}/${label}?${params.join("&")}`;
}
function totp(options) {
  const extra = [];
  if (options.period !== undefined) {
    if (!Number.isInteger(options.period) || options.period <= 0) {
      throw new RangeError("period must be a positive integer number of seconds.");
    }
    if (options.period !== 30)
      extra.push(`period=${options.period}`);
  }
  return otpauth("totp", options, extra);
}
function hotp(options) {
  if (!Number.isInteger(options.counter) || options.counter < 0) {
    throw new RangeError("counter must be a non-negative integer.");
  }
  return otpauth("hotp", options, [`counter=${options.counter}`]);
}
function mecard(options) {
  const fields = [];
  if (options.lastName !== undefined || options.firstName !== undefined) {
    fields.push(`N:${escapeMecard(options.lastName ?? "")},${escapeMecard(options.firstName ?? "")}`);
  }
  for (const phone of options.phones ?? [])
    fields.push(`TEL:${escapeMecard(phone)}`);
  for (const address of options.emails ?? [])
    fields.push(`EMAIL:${escapeMecard(address)}`);
  if (options.organization !== undefined)
    fields.push(`ORG:${escapeMecard(options.organization)}`);
  for (const link of options.urls ?? [])
    fields.push(`URL:${escapeMecard(link)}`);
  if (options.birthday !== undefined)
    fields.push(`BDAY:${formatDate(options.birthday, true)}`);
  if (options.address !== undefined) {
    const parts = [options.address.street, options.address.city, options.address.region, options.address.postalCode, options.address.country];
    const line = parts.filter((part) => part !== undefined && part.length > 0).join(" ");
    if (line.length > 0)
      fields.push(`ADR:${escapeMecard(line)}`);
  }
  if (options.note !== undefined)
    fields.push(`NOTE:${escapeMecard(options.note)}`);
  if (fields.length === 0)
    throw new RangeError("a contact needs at least a name, organization, phone or email.");
  return `MECARD:${fields.join(";")};;`;
}
function vcard(options) {
  const hasName = options.firstName !== undefined || options.lastName !== undefined || options.displayName !== undefined;
  if (!hasName && options.organization === undefined && (options.phones ?? []).length === 0 && (options.emails ?? []).length === 0) {
    throw new RangeError("a contact needs at least a name, organization, phone or email.");
  }
  const display = options.displayName ?? [options.firstName, options.lastName].filter((part) => part !== undefined && part.length > 0).join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:4.0"];
  if (hasName)
    lines.push(`N:${escapeIcal(options.lastName ?? "")};${escapeIcal(options.firstName ?? "")};;;`);
  if (display.length > 0)
    lines.push(`FN:${escapeIcal(display)}`);
  if (options.organization !== undefined)
    lines.push(`ORG:${escapeIcal(options.organization)}`);
  if (options.title !== undefined)
    lines.push(`TITLE:${escapeIcal(options.title)}`);
  for (const phone of options.phones ?? [])
    lines.push(`TEL:${escapeIcal(phone)}`);
  for (const address of options.emails ?? [])
    lines.push(`EMAIL:${escapeIcal(address)}`);
  for (const link of options.urls ?? [])
    lines.push(`URL:${escapeIcal(link)}`);
  if (options.birthday !== undefined)
    lines.push(`BDAY:${formatDate(options.birthday, true)}`);
  if (options.address !== undefined) {
    const { street = "", city = "", region = "", postalCode = "", country = "" } = options.address;
    lines.push(`ADR:;;${escapeIcal(street)};${escapeIcal(city)};${escapeIcal(region)};${escapeIcal(postalCode)};${escapeIcal(country)}`);
  }
  if (options.note !== undefined)
    lines.push(`NOTE:${escapeIcal(options.note)}`);
  lines.push("END:VCARD");
  return lines.join(`\r
`);
}
function event(options) {
  if (options.title.trim().length === 0)
    throw new RangeError("title cannot be empty.");
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
  if (options.location !== undefined)
    lines.push(`LOCATION:${escapeIcal(options.location)}`);
  if (options.description !== undefined)
    lines.push(`DESCRIPTION:${escapeIcal(options.description)}`);
  lines.push("END:VEVENT");
  return lines.join(`\r
`);
}
var BECH32_DATA = "[qpzry9x8gf2tvdw0s3jn54khce6mua7l]";
var BITCOIN_BECH32 = new RegExp(`^(bc|tb|bcrt)1${BECH32_DATA}{6,87}$`, "i");
var BITCOIN_BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,39}$/;
var HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
var BASE58_ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
var MONERO_ADDRESS = /^[48][0-9A-Za-z]{94,105}$/;
var LIGHTNING_INVOICE = new RegExp(`^ln(bc|tb|bcrt|sb)[0-9]+[munp]?1${BECH32_DATA}+$`, "i");
function decimalAmount(value, decimals, name) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new RangeError(`${name} must be a plain decimal amount, such as "0.001", not "${value}".`);
    }
    return trimmed;
  }
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a finite, non-negative number.`);
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}
function integerAmount(value, name) {
  if (typeof value === "bigint") {
    if (value < 0n)
      throw new RangeError(`${name} cannot be negative.`);
    return value.toString();
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed))
    throw new RangeError(`${name} must be a whole number of the smallest unit, as a bigint or a digit string.`);
  return trimmed;
}
function query(entries) {
  const parts = entries.filter((entry) => entry[1] !== undefined).map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
function hexAddress(address, name) {
  const trimmed = address.trim();
  if (!HEX_ADDRESS.test(trimmed))
    throw new RangeError(`${name} must be a 0x-prefixed 40 character hexadecimal address.`);
  return trimmed;
}
function bip21(scheme, address, options = {}) {
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme))
    throw new RangeError(`"${scheme}" is not a valid URI scheme.`);
  const recipient = address.trim();
  if (recipient.length === 0)
    throw new RangeError("address cannot be empty.");
  if (/[\s?#&]/.test(recipient))
    throw new RangeError(`"${address}" is not a valid address.`);
  const extra = Object.entries(options.params ?? {}).map(([key, value]) => [key, value]);
  return `${scheme}:${recipient}` + query([
    ["amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 8, "amount")],
    ["label", options.label],
    ["message", options.message],
    ...extra
  ]);
}
function bitcoin(address, options = {}) {
  const trimmed = address.trim();
  const isBech32 = BITCOIN_BECH32.test(trimmed);
  if (!isBech32 && !BITCOIN_BASE58.test(trimmed)) {
    throw new RangeError(`"${address}" is not a recognized Bitcoin address. Expected a bech32 address such as bc1... or a legacy base58 address.`);
  }
  const fold = options.compact !== false && isBech32;
  const uri = bip21(fold ? "BITCOIN" : "bitcoin", fold ? trimmed.toUpperCase() : trimmed, options);
  return uri;
}
function ethereum(options) {
  const to = hexAddress(options.to, "to");
  const chain = options.chainId === undefined ? "" : `@${positiveInteger(options.chainId, "chainId")}`;
  return `ethereum:${to}${chain}` + query([
    ["value", options.value === undefined ? undefined : integerAmount(options.value, "value")],
    ["gasLimit", options.gasLimit === undefined ? undefined : String(positiveInteger(options.gasLimit, "gasLimit"))]
  ]);
}
function erc20(options) {
  const contract = hexAddress(options.contract, "contract");
  const to = hexAddress(options.to, "to");
  const chain = options.chainId === undefined ? "" : `@${positiveInteger(options.chainId, "chainId")}`;
  return `ethereum:${contract}${chain}/transfer${query([
    ["address", to],
    ["uint256", integerAmount(options.amount, "amount")]
  ])}`;
}
function solana(recipient, options = {}) {
  const to = recipient.trim();
  if (!BASE58_ACCOUNT.test(to))
    throw new RangeError(`"${recipient}" is not a valid Solana account address.`);
  if (options.splToken !== undefined && !BASE58_ACCOUNT.test(options.splToken.trim())) {
    throw new RangeError(`"${options.splToken}" is not a valid SPL token mint address.`);
  }
  if (options.reference !== undefined && !BASE58_ACCOUNT.test(options.reference.trim())) {
    throw new RangeError(`"${options.reference}" is not a valid reference account address.`);
  }
  return `solana:${to}` + query([
    ["amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 9, "amount")],
    ["spl-token", options.splToken?.trim()],
    ["reference", options.reference?.trim()],
    ["label", options.label],
    ["message", options.message],
    ["memo", options.memo]
  ]);
}
function monero(address, options = {}) {
  const to = address.trim();
  if (!MONERO_ADDRESS.test(to))
    throw new RangeError(`"${address}" is not a recognized Monero address.`);
  return `monero:${to}` + query([
    ["tx_amount", options.amount === undefined ? undefined : decimalAmount(options.amount, 12, "amount")],
    ["tx_payment_id", options.paymentId],
    ["recipient_name", options.recipientName],
    ["tx_description", options.description]
  ]);
}
function lightning(invoice, options = {}) {
  const trimmed = invoice.trim().replace(/^lightning:/i, "");
  if (!LIGHTNING_INVOICE.test(trimmed))
    throw new RangeError(`"${invoice}" is not a recognized BOLT-11 Lightning invoice.`);
  return options.compact === false ? `lightning:${trimmed}` : `LIGHTNING:${trimmed.toUpperCase()}`;
}
function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0)
    throw new RangeError(`${name} must be a positive integer.`);
  return value;
}
var UPI_VPA = /^[A-Za-z0-9.\-_]{1,256}@[A-Za-z][A-Za-z0-9.\-_]{0,63}$/;
var IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;
var BIC_SHAPE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
var EPC_MAX_BYTES = 331;
function crc16(text) {
  let crc = 65535;
  for (let i = 0;i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0;bit < 8; bit++) {
      crc = (crc & 32768) !== 0 ? (crc << 1 ^ 4129) & 65535 : crc << 1 & 65535;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function tlv(id, value) {
  if (value.length > 99)
    throw new RangeError(`field ${id} is ${value.length} characters, and the format allows at most 99.`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}
function mod10CheckDigit(body) {
  let sum = 0;
  let weight = 3;
  for (let i = body.length - 1;i >= 0; i--) {
    sum += Number(body[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - sum % 10) % 10;
}
function ibanChecksumValid(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
function limited(value, max, name) {
  const trimmed = value.trim();
  if (trimmed.length === 0)
    throw new RangeError(`${name} cannot be empty.`);
  if (trimmed.length > max)
    throw new RangeError(`${name} is ${trimmed.length} characters, and the format allows at most ${max}.`);
  return trimmed;
}
function upi(options) {
  const address = options.payeeAddress.trim();
  if (!UPI_VPA.test(address)) {
    throw new RangeError(`"${options.payeeAddress}" is not a valid virtual payment address. Expected a form like "name@bank".`);
  }
  if (options.merchantCode !== undefined && !/^\d{4}$/.test(options.merchantCode)) {
    throw new RangeError("merchantCode must be four digits.");
  }
  return "upi://pay" + query([
    ["pa", address],
    ["pn", limited(options.payeeName, 99, "payeeName")],
    ["am", options.amount === undefined ? undefined : decimalAmount(options.amount, 2, "amount")],
    ["mam", options.minimumAmount === undefined ? undefined : decimalAmount(options.minimumAmount, 2, "minimumAmount")],
    ["cu", "INR"],
    ["tn", options.note === undefined ? undefined : limited(options.note, 50, "note")],
    ["tr", options.reference],
    ["tid", options.transactionId],
    ["mc", options.merchantCode]
  ]);
}
function epc(options) {
  const version = options.version ?? "002";
  const iban = options.iban.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_SHAPE.test(iban) || !ibanChecksumValid(iban)) {
    throw new RangeError(`"${options.iban}" is not a valid IBAN. The mod-97 checksum does not hold.`);
  }
  const bic = options.bic === undefined ? "" : options.bic.replace(/\s+/g, "").toUpperCase();
  if (bic !== "" && !BIC_SHAPE.test(bic))
    throw new RangeError(`"${options.bic}" is not a valid BIC.`);
  if (version === "001" && bic === "")
    throw new RangeError('version "001" requires a bic. Use version "002" to omit it.');
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
    "1",
    "SCT",
    bic,
    limited(options.name, 70, "name"),
    iban,
    amount,
    options.purpose === undefined ? "" : options.purpose.toUpperCase(),
    options.reference === undefined ? "" : limited(options.reference, 35, "reference"),
    options.remittance === undefined ? "" : limited(options.remittance, 140, "remittance"),
    options.information === undefined ? "" : limited(options.information, 70, "information")
  ];
  while (lines.length > 0 && lines[lines.length - 1] === "")
    lines.pop();
  const payload = lines.join(`
`);
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > EPC_MAX_BYTES) {
    throw new RangeError(`the payload is ${bytes} bytes, and the standard allows at most ${EPC_MAX_BYTES}. Shorten the remittance or name.`);
  }
  return payload;
}
function gs1(options) {
  const digits = options.gtin.replace(/\s+/g, "");
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) {
    throw new RangeError(`"${options.gtin}" is not a GTIN. Expected 8, 12, 13 or 14 digits.`);
  }
  if (mod10CheckDigit(digits.slice(0, -1)) !== Number(digits[digits.length - 1])) {
    throw new RangeError(`the check digit of GTIN "${options.gtin}" is wrong.`);
  }
  const gtin = digits.padStart(14, "0");
  const domain = (options.domain ?? "https://id.gs1.org").replace(/\/+$/, "");
  const path = [
    ["01", gtin],
    ["22", options.cpv],
    ["10", options.lot],
    ["21", options.serial]
  ].filter((entry) => entry[1] !== undefined).map(([ai, value]) => `${ai}/${encodeURIComponent(value)}`).join("/");
  const attributes = Object.entries(options.attributes ?? {});
  for (const [ai] of attributes) {
    if (!/^\d{2,4}$/.test(ai))
      throw new RangeError(`"${ai}" is not a GS1 application identifier.`);
  }
  return `${domain}/${path}${query(attributes.map(([ai, value]) => [ai, value]))}`;
}
function pix(options) {
  const code = options.merchantCategoryCode ?? "0000";
  if (!/^\d{4}$/.test(code))
    throw new RangeError("merchantCategoryCode must be four digits.");
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", limited(options.key, 77, "key")) + (options.description === undefined ? "" : tlv("02", limited(options.description, 72, "description")));
  const body = tlv("00", "01") + (options.oneTime === true ? tlv("01", "12") : "") + tlv("26", account) + tlv("52", code) + tlv("53", "986") + (options.amount === undefined ? "" : tlv("54", decimalAmount(options.amount, 2, "amount"))) + tlv("58", "BR") + tlv("59", limited(options.name, 25, "name")) + tlv("60", limited(options.city, 15, "city")) + tlv("62", tlv("05", options.reference === undefined ? "***" : limited(options.reference, 25, "reference")));
  const withTag = `${body}6304`;
  return withTag + crc16(withTag);
}
var LATIN2_HIGH = " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ" + "°ą˛ł´ľśˇ¸šşťź˝žż" + "ŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎ" + "ĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢß" + "ŕáâăäĺćçčéęëěíîď" + "đńňóôőö÷řůúűüýţ˙";
var UPN_REFERENCE = /^(SI\d{2}|RF\d{2})[0-9\-]{0,22}$/;
function latin2(value) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0;i < value.length; i++) {
    const point = value.codePointAt(i);
    if (point < 128) {
      bytes[i] = point;
      continue;
    }
    const high = LATIN2_HIGH.indexOf(value[i]);
    if (high === -1) {
      throw new RangeError(`"${value[i]}" has no ISO-8859-2 representation, which UPN QR requires. Replace it with a Latin-2 character.`);
    }
    bytes[i] = 160 + high;
  }
  return bytes;
}
function upn(options) {
  const iban = options.recipientIban.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_SHAPE.test(iban) || !ibanChecksumValid(iban)) {
    throw new RangeError(`"${options.recipientIban}" is not a valid IBAN. The mod-97 checksum does not hold.`);
  }
  const reference = (options.recipientReference ?? "SI99").replace(/\s+/g, "").toUpperCase();
  if (!UPN_REFERENCE.test(reference)) {
    throw new RangeError(`"${options.recipientReference}" is not a valid reference. Expected a form like "SI99" or "SI121234567890123".`);
  }
  const purposeCode = (options.purposeCode ?? "OTHR").toUpperCase();
  if (!/^[A-Z]{4}$/.test(purposeCode))
    throw new RangeError("purposeCode must be four letters.");
  let cents = "0".repeat(11);
  if (options.amount !== undefined) {
    const euro = decimalAmount(options.amount, 2, "amount");
    const value = Math.round(Number(euro) * 100);
    if (value > 99999999999)
      throw new RangeError("amount is larger than eleven digits of cents can hold.");
    cents = String(value).padStart(11, "0");
  }
  const date = (value) => {
    if (value === undefined)
      return "";
    if (Number.isNaN(value.getTime()))
      throw new RangeError("dueDate is invalid.");
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${value.getFullYear()}`;
  };
  const capped = (value, max, name) => value === undefined ? "" : limited(value, max, name);
  const fields = [
    "UPNQR",
    capped(options.payerIban, 19, "payerIban"),
    "",
    "",
    capped(options.payerReference, 26, "payerReference"),
    capped(options.payerName, 33, "payerName"),
    capped(options.payerStreet, 33, "payerStreet"),
    capped(options.payerCity, 33, "payerCity"),
    cents,
    "",
    options.urgent === true ? "X" : "",
    purposeCode,
    capped(options.purpose, 42, "purpose"),
    date(options.dueDate),
    iban,
    reference,
    limited(options.recipientName, 33, "recipientName"),
    capped(options.recipientStreet, 33, "recipientStreet"),
    capped(options.recipientCity, 33, "recipientCity")
  ];
  const body = fields.map((field) => `${field}
`).join("");
  return `${body}${String(body.length).padStart(3, "0")}`;
}
export {
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
  wifi
};
