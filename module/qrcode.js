// src/types.ts
var ErrorCorrectionLevel;
((ErrorCorrectionLevel) => {
  ErrorCorrectionLevel["LOW"] = "L";
  ErrorCorrectionLevel["MEDIUM"] = "M";
  ErrorCorrectionLevel["QUARTILE"] = "Q";
  ErrorCorrectionLevel["HIGH"] = "H";
})(ErrorCorrectionLevel ||= {});
var Mode;
((Mode) => {
  Mode["NUMERIC"] = "numeric";
  Mode["ALPHANUMERIC"] = "alphanumeric";
  Mode["BYTE"] = "byte";
})(Mode ||= {});

// src/constants.ts
var MIN_VERSION = 1;
var MAX_VERSION = 40;
var ECC_ORDER = ["L" /* LOW */, "M" /* MEDIUM */, "Q" /* QUARTILE */, "H" /* HIGH */];
var ECC_FORMAT_BITS = {
  ["L" /* LOW */]: 1,
  ["M" /* MEDIUM */]: 0,
  ["Q" /* QUARTILE */]: 3,
  ["H" /* HIGH */]: 2
};
function eccIndex(level) {
  return ECC_ORDER.indexOf(level);
}
var ECC_CODEWORDS_PER_BLOCK = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
var ECC_BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
var CHAR_COUNT_BITS = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16]
};
var MODE_BITS = {
  numeric: 1,
  alphanumeric: 2,
  byte: 4
};
var ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7)
      result -= 36;
  }
  return result;
}
function dataCodewords(version, level) {
  const ecc = eccIndex(level);
  return Math.floor(rawDataModules(version) / 8) - (ECC_CODEWORDS_PER_BLOCK[ecc]?.[version] ?? 0) * (ECC_BLOCKS[ecc]?.[version] ?? 0);
}
function alignmentPositions(version) {
  if (version === 1)
    return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const positions = [6];
  for (let pos = size - 7;positions.length < count; pos -= step) {
    positions.splice(1, 0, pos);
  }
  return positions;
}
function versionGroup(version) {
  if (version <= 9)
    return 0;
  if (version <= 26)
    return 1;
  return 2;
}

// src/reed-solomon.ts
var PRIMITIVE = 285;
var EXP = new Uint8Array(256);
var LOG = new Uint8Array(256);
{
  let value = 1;
  for (let i = 0;i < 255; i++) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 256)
      value ^= PRIMITIVE;
  }
}
function multiply(a, b) {
  if (a === 0 || b === 0)
    return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}
function generatorPolynomial(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0;i < degree; i++) {
    for (let j = 0;j < degree; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree)
        result[j] = result[j] ^ result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}
var generators = new Map;
function generator(degree) {
  let polynomial = generators.get(degree);
  if (polynomial === undefined) {
    polynomial = generatorPolynomial(degree);
    generators.set(degree, polynomial);
  }
  return polynomial;
}
function encode(data, eccLength) {
  const divisor = generator(eccLength);
  const result = new Uint8Array(eccLength);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[eccLength - 1] = 0;
    for (let i = 0;i < eccLength; i++) {
      result[i] = result[i] ^ multiply(divisor[i], factor);
    }
  }
  return result;
}

// src/segment.ts
class BitBuffer {
  bits = [];
  get length() {
    return this.bits.length;
  }
  push(value, count) {
    for (let i = count - 1;i >= 0; i--) {
      this.bits.push(value >>> i & 1);
    }
  }
  append(other) {
    this.bits.push(...other.bits);
  }
  toBytes() {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, index) => {
      if (bit === 1)
        bytes[index >>> 3] = bytes[index >>> 3] | 128 >>> index % 8;
    });
    return bytes;
  }
}
function numericSegment(digits) {
  const bits = new BitBuffer;
  for (let i = 0;i < digits.length; i += 3) {
    const chunk = digits.slice(i, i + 3);
    bits.push(Number.parseInt(chunk, 10), chunk.length * 3 + 1);
  }
  return { mode: "numeric" /* NUMERIC */, length: digits.length, bits };
}
function alphanumericSegment(text) {
  const bits = new BitBuffer;
  for (let i = 0;i + 1 < text.length; i += 2) {
    const high = ALPHANUMERIC_CHARSET.indexOf(text[i]);
    const low = ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
    bits.push(high * 45 + low, 11);
  }
  if (text.length % 2 === 1) {
    bits.push(ALPHANUMERIC_CHARSET.indexOf(text[text.length - 1]), 6);
  }
  return { mode: "alphanumeric" /* ALPHANUMERIC */, length: text.length, bits };
}
function byteSegment(data) {
  const bits = new BitBuffer;
  for (const byte of data)
    bits.push(byte, 8);
  return { mode: "byte" /* BYTE */, length: data.length, bits };
}
function segmentBitLength(segment, version) {
  const countBits = CHAR_COUNT_BITS[segment.mode][versionGroup(version)];
  return 4 + countBits + segment.bits.length;
}
function totalBitLength(segments, version) {
  return segments.reduce((sum, segment) => sum + segmentBitLength(segment, version), 0);
}
function writeSegment(segment, version, out) {
  out.push(MODE_BITS[segment.mode], 4);
  out.push(segment.length, CHAR_COUNT_BITS[segment.mode][versionGroup(version)]);
  out.append(segment.bits);
}
var MODE_ORDER = ["byte" /* BYTE */, "alphanumeric" /* ALPHANUMERIC */, "numeric" /* NUMERIC */];
var SIXTHS = 6;
function utf8Length(codePoint) {
  if (codePoint < 128)
    return 1;
  if (codePoint < 2048)
    return 2;
  if (codePoint < 65536)
    return 3;
  return 4;
}
function isNumericCodePoint(codePoint) {
  return codePoint >= 48 && codePoint <= 57;
}
function isAlphanumericCodePoint(codePoint) {
  return ALPHANUMERIC_CHARSET.indexOf(String.fromCodePoint(codePoint)) !== -1;
}
function chooseModes(codePoints, version) {
  const headCosts = MODE_ORDER.map((mode) => (4 + CHAR_COUNT_BITS[mode][versionGroup(version)]) * SIXTHS);
  const charModes = [];
  let previous = [...headCosts];
  for (const codePoint of codePoints) {
    const modes = [null, null, null];
    const costs = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    costs[0] = previous[0] + utf8Length(codePoint) * 8 * SIXTHS;
    modes[0] = "byte" /* BYTE */;
    if (isAlphanumericCodePoint(codePoint)) {
      costs[1] = previous[1] + 33;
      modes[1] = "alphanumeric" /* ALPHANUMERIC */;
    }
    if (isNumericCodePoint(codePoint)) {
      costs[2] = previous[2] + 20;
      modes[2] = "numeric" /* NUMERIC */;
    }
    for (let j = 0;j < MODE_ORDER.length; j++) {
      for (let k = 0;k < MODE_ORDER.length; k++) {
        const switched = Math.ceil(costs[k] / SIXTHS) * SIXTHS + headCosts[j];
        if (modes[k] !== null && (modes[j] === null || switched < costs[j])) {
          costs[j] = switched;
          modes[j] = MODE_ORDER[k];
        }
      }
    }
    charModes.push(modes);
    previous = costs;
  }
  let end = 0;
  for (let i = 1;i < MODE_ORDER.length; i++) {
    if (previous[i] < previous[end])
      end = i;
  }
  let current = MODE_ORDER[end];
  const result = [];
  for (let i = codePoints.length - 1;i >= 0; i--) {
    const index = MODE_ORDER.indexOf(current);
    current = charModes[i][index];
    result.push(current);
  }
  return result.reverse();
}
function makeSegments(text, version) {
  if (text.length === 0)
    return [];
  const codePoints = [...text].map((character) => character.codePointAt(0));
  const modes = chooseModes(codePoints, version);
  const segments = [];
  let start = 0;
  for (let i = 1;i <= codePoints.length; i++) {
    if (i < codePoints.length && modes[i] === modes[start])
      continue;
    const run = codePoints.slice(start, i).map((codePoint) => String.fromCodePoint(codePoint)).join("");
    switch (modes[start]) {
      case "numeric" /* NUMERIC */:
        segments.push(numericSegment(run));
        break;
      case "alphanumeric" /* ALPHANUMERIC */:
        segments.push(alphanumericSegment(run));
        break;
      default:
        segments.push(byteSegment(new TextEncoder().encode(run)));
        break;
    }
    start = i;
  }
  return segments;
}

// src/qrcode.ts
var PAD_CODEWORDS = [236, 17];
var PENALTY_N1 = 3;
var PENALTY_N2 = 3;
var PENALTY_N3 = 40;
var PENALTY_N4 = 10;

class QRCode {
  version;
  size;
  errorCorrectionLevel;
  mask;
  modules;
  reserved;
  constructor(version, level, codewords, mask) {
    this.version = version;
    this.size = version * 4 + 17;
    this.errorCorrectionLevel = level;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.drawFunctionPatterns();
    this.drawCodewords(codewords);
    this.mask = this.applyBestMask(mask);
    this.drawFormatBits(this.mask);
  }
  static encode(text, options = {}) {
    return QRCode.fromSegments((version) => makeSegments(text, version), options);
  }
  static encodeBinary(data, options = {}) {
    const segments = [byteSegment(data)];
    return QRCode.fromSegments(() => segments, options);
  }
  static fromSegments(segmentsFor, options) {
    const requested = options.errorCorrectionLevel ?? "M" /* MEDIUM */;
    const minVersion = clampVersion(options.minVersion ?? MIN_VERSION, "minVersion");
    const maxVersion = clampVersion(options.maxVersion ?? MAX_VERSION, "maxVersion");
    const mask = options.mask ?? -1;
    const boost = options.boostEcc ?? true;
    if (minVersion > maxVersion)
      throw new RangeError("minVersion cannot be greater than maxVersion.");
    if (mask < -1 || mask > 7)
      throw new RangeError("mask must be between 0 and 7, or -1 to choose automatically.");
    let version = minVersion;
    let segments = [];
    let usedBits = 0;
    for (;; version++) {
      if (version > maxVersion) {
        throw new RangeError(`Data is too long: it does not fit in a version ${maxVersion} symbol at error correction level ${requested}.`);
      }
      segments = segmentsFor(version);
      usedBits = totalBitLength(segments, version);
      if (usedBits <= dataCodewords(version, requested) * 8)
        break;
    }
    let level = requested;
    if (boost) {
      for (const candidate of ECC_ORDER) {
        if (eccIndex(candidate) > eccIndex(level) && usedBits <= dataCodewords(version, candidate) * 8) {
          level = candidate;
        }
      }
    }
    return new QRCode(version, level, buildCodewords(segments, version, level), mask);
  }
  getModule(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size)
      return false;
    return this.modules[y]?.[x] ?? false;
  }
  toArray() {
    return this.modules.map((row) => [...row]);
  }
  set(x, y, dark, isFunction) {
    const row = this.modules[y];
    const reservedRow = this.reserved[y];
    if (row === undefined || reservedRow === undefined)
      return;
    row[x] = dark;
    if (isFunction)
      reservedRow[x] = true;
  }
  drawFunctionPatterns() {
    for (let i = 0;i < this.size; i++) {
      this.set(6, i, i % 2 === 0, true);
      this.set(i, 6, i % 2 === 0, true);
    }
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);
    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    for (let i = 0;i <= last; i++) {
      for (let j = 0;j <= last; j++) {
        const corner = i === 0 && j === 0 || i === 0 && j === last || i === last && j === 0;
        if (!corner)
          this.drawAlignment(positions[i], positions[j]);
      }
    }
    this.drawFormatBits(0);
    this.drawVersionBits();
  }
  drawFinder(cx, cy) {
    for (let dy = -4;dy <= 4; dy++) {
      for (let dx = -4;dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.set(x, y, distance !== 2 && distance !== 4, true);
        }
      }
    }
  }
  drawAlignment(cx, cy) {
    for (let dy = -2;dy <= 2; dy++) {
      for (let dx = -2;dx <= 2; dx++) {
        this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
      }
    }
  }
  drawFormatBits(mask) {
    const data = ECC_FORMAT_BITS[this.errorCorrectionLevel] << 3 | mask;
    let remainder = data;
    for (let i = 0;i < 10; i++)
      remainder = remainder << 1 ^ (remainder >>> 9) * 1335;
    const bits = (data << 10 | remainder) ^ 21522;
    const bit = (i) => (bits >>> i & 1) !== 0;
    for (let i = 0;i <= 5; i++)
      this.set(8, i, bit(i), true);
    this.set(8, 7, bit(6), true);
    this.set(8, 8, bit(7), true);
    this.set(7, 8, bit(8), true);
    for (let i = 9;i < 15; i++)
      this.set(14 - i, 8, bit(i), true);
    for (let i = 0;i < 8; i++)
      this.set(this.size - 1 - i, 8, bit(i), true);
    for (let i = 8;i < 15; i++)
      this.set(8, this.size - 15 + i, bit(i), true);
    this.set(8, this.size - 8, true, true);
  }
  drawVersionBits() {
    if (this.version < 7)
      return;
    let remainder = this.version;
    for (let i = 0;i < 12; i++)
      remainder = remainder << 1 ^ (remainder >>> 11) * 7973;
    const bits = this.version << 12 | remainder;
    for (let i = 0;i < 18; i++) {
      const dark = (bits >>> i & 1) !== 0;
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.set(a, b, dark, true);
      this.set(b, a, dark, true);
    }
  }
  drawCodewords(codewords) {
    let index = 0;
    for (let right = this.size - 1;right >= 1; right -= 2) {
      if (right === 6)
        right = 5;
      for (let step = 0;step < this.size; step++) {
        for (let column = 0;column < 2; column++) {
          const x = right - column;
          const upward = (right + 1 & 2) === 0;
          const y = upward ? this.size - 1 - step : step;
          if (this.reserved[y]?.[x] === true)
            continue;
          const dark = index < codewords.length * 8 && (codewords[index >>> 3] >>> 7 - index % 8 & 1) !== 0;
          this.set(x, y, dark, false);
          index++;
        }
      }
    }
  }
  static maskAt(pattern, x, y) {
    switch (pattern) {
      case 0:
        return (x + y) % 2 === 0;
      case 1:
        return y % 2 === 0;
      case 2:
        return x % 3 === 0;
      case 3:
        return (x + y) % 3 === 0;
      case 4:
        return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5:
        return x * y % 2 + x * y % 3 === 0;
      case 6:
        return (x * y % 2 + x * y % 3) % 2 === 0;
      case 7:
        return ((x + y) % 2 + x * y % 3) % 2 === 0;
      default:
        throw new RangeError(`Invalid mask pattern: ${pattern}`);
    }
  }
  applyMask(pattern) {
    for (let y = 0;y < this.size; y++) {
      for (let x = 0;x < this.size; x++) {
        if (this.reserved[y]?.[x] === true)
          continue;
        const row = this.modules[y];
        if (row !== undefined)
          row[x] = row[x] !== QRCode.maskAt(pattern, x, y);
      }
    }
  }
  applyBestMask(requested) {
    if (requested !== -1) {
      this.applyMask(requested);
      return requested;
    }
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let pattern = 0;pattern < 8; pattern++) {
      this.applyMask(pattern);
      this.drawFormatBits(pattern);
      const score = this.penaltyScore();
      if (score < bestScore) {
        bestScore = score;
        best = pattern;
      }
      this.applyMask(pattern);
    }
    this.applyMask(best);
    return best;
  }
  penaltyScore() {
    let score = 0;
    for (let i = 0;i < this.size; i++) {
      score += this.lineScore((j) => this.getModule(j, i));
      score += this.lineScore((j) => this.getModule(i, j));
    }
    for (let y = 0;y < this.size - 1; y++) {
      for (let x = 0;x < this.size - 1; x++) {
        const color = this.getModule(x, y);
        if (color === this.getModule(x + 1, y) && color === this.getModule(x, y + 1) && color === this.getModule(x + 1, y + 1)) {
          score += PENALTY_N2;
        }
      }
    }
    let dark = 0;
    for (let y = 0;y < this.size; y++) {
      for (let x = 0;x < this.size; x++)
        if (this.getModule(x, y))
          dark++;
    }
    const total = this.size * this.size;
    const steps = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += steps * PENALTY_N4;
    return score;
  }
  lineScore(at) {
    let score = 0;
    let runColor = false;
    let runLength = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    const addRun = (length) => {
      if (history[0] === 0)
        length += this.size;
      history.pop();
      history.unshift(length);
    };
    const finderCount = () => {
      const n = history[1];
      const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      if (!core)
        return 0;
      return (history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (history[6] >= n * 4 && history[0] >= n ? 1 : 0);
    };
    for (let i = 0;i < this.size; i++) {
      const color = at(i);
      if (color === runColor) {
        runLength++;
        if (runLength === 5)
          score += PENALTY_N1;
        else if (runLength > 5)
          score += 1;
      } else {
        addRun(runLength);
        if (!runColor)
          score += finderCount() * PENALTY_N3;
        runColor = color;
        runLength = 1;
      }
    }
    if (runColor) {
      addRun(runLength);
      runLength = 0;
    }
    addRun(runLength + this.size);
    score += finderCount() * PENALTY_N3;
    return score;
  }
  correctableModules() {
    const ecc = eccIndex(this.errorCorrectionLevel);
    const perBlock = ECC_CODEWORDS_PER_BLOCK[ecc]?.[this.version] ?? 0;
    const blocks = ECC_BLOCKS[ecc]?.[this.version] ?? 0;
    return blocks * Math.floor(perBlock / 2) * 8;
  }
  placeLogo(logo) {
    const extent = logo.size ?? Math.floor(this.size * 0.2);
    const padding = logo.padding ?? 1;
    if (logo.content.length === 0)
      throw new RangeError("logo.content cannot be empty.");
    if (!(extent > 0))
      throw new RangeError("logo.size must be positive.");
    if (!(padding >= 0))
      throw new RangeError("logo.padding cannot be negative.");
    if (extent > this.size)
      throw new RangeError(`logo.size of ${extent} modules does not fit in a ${this.size} module symbol.`);
    const origin = (this.size - extent) / 2;
    const clearFrom = Math.max(0, Math.floor(origin - padding));
    const clearTo = Math.min(this.size, Math.ceil(origin + extent + padding));
    if (logo.skipChecks !== true) {
      if (clearFrom < 8) {
        throw new RangeError(`A logo of ${extent} modules would cover a finder pattern, which a scanner needs to locate the symbol at all. ` + `Reduce logo.size or logo.padding, or encode more data so the symbol grows.`);
      }
      const hidden = (clearTo - clearFrom) ** 2;
      const correctable = this.correctableModules();
      if (hidden > correctable) {
        throw new RangeError(`A logo of ${extent} modules hides ${hidden} modules, more than the ${correctable} that error correction level ` + `${this.errorCorrectionLevel} can recover in a version ${this.version} symbol. Reduce logo.size, raise ` + `errorCorrectionLevel, or raise minVersion so the symbol has more room.`);
      }
    }
    return { origin, extent, clearFrom, clearTo };
  }
  frameBand(frame, margin) {
    const band = frame.width ?? 4;
    if (!(band > 0))
      throw new RangeError("frame.width must be positive.");
    if (margin < 1) {
      throw new RangeError("a frame needs a quiet zone of at least 1 module to sit outside of, or a dark band merges into the edge of the symbol. Raise margin to 1 or more, or drop the frame.");
    }
    return band;
  }
  toSVG(options = {}) {
    const margin = options.margin ?? 4;
    const scale = options.scale ?? 1;
    const dark = options.dark ?? "#000000";
    const light = options.light ?? "#ffffff";
    if (margin < 0)
      throw new RangeError("margin cannot be negative.");
    if (scale <= 0)
      throw new RangeError("scale must be positive.");
    const band = options.frame === undefined ? 0 : this.frameBand(options.frame, margin);
    const inner = (this.size + margin * 2) * scale;
    const extent = inner + band * scale * 2;
    const offset = band * scale;
    const placement = options.logo === undefined ? undefined : this.placeLogo(options.logo);
    const clearFrom = placement?.clearFrom ?? 0;
    const clearTo = placement?.clearTo ?? 0;
    const parts = [];
    for (let y = 0;y < this.size; y++) {
      const clearedRow = y >= clearFrom && y < clearTo;
      for (let x = 0;x < this.size; x++) {
        if (clearedRow && x >= clearFrom && x < clearTo)
          continue;
        if (this.getModule(x, y)) {
          parts.push(`M${offset + (x + margin) * scale} ${offset + (y + margin) * scale}h${scale}v${scale}h-${scale}z`);
        }
      }
    }
    const dimensions = options.size === undefined ? "" : ` width="${options.size}" height="${options.size}"`;
    const title = options.title === undefined ? "" : `<title>${escapeXml(options.title)}</title>`;
    const background = light === "transparent" ? "" : `<rect x="${offset}" y="${offset}" width="${inner}" height="${inner}" fill="${escapeXml(light)}"/>`;
    const declaration = options.xmlDeclaration === true ? `<?xml version="1.0" encoding="UTF-8"?>` : "";
    const logo = placement === undefined || options.logo === undefined ? "" : this.renderLogo(options.logo, placement, margin + band, scale, light);
    const frame = options.frame === undefined ? "" : renderFrame(options.frame, band, extent, scale);
    return `${declaration}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"${dimensions} ` + `shape-rendering="crispEdges" role="img">${title}${frame}${background}` + `<path fill="${escapeXml(dark)}" d="${parts.join("")}"/>${logo}</svg>`;
  }
  renderLogo(logo, placement, margin, scale, light) {
    const plateOffset = (placement.clearFrom + margin) * scale;
    const plateExtent = (placement.clearTo - placement.clearFrom) * scale;
    const offset = (placement.origin + margin) * scale;
    const extent = placement.extent * scale;
    const fill = logo.background ?? light;
    const plate = fill === "transparent" ? "" : `<rect x="${plateOffset}" y="${plateOffset}" width="${plateExtent}" height="${plateExtent}" fill="${escapeXml(fill)}"/>`;
    const box = `x="${offset}" y="${offset}" width="${extent}" height="${extent}"`;
    const art = logo.content.trimStart().startsWith("<") ? `<svg ${box} overflow="hidden" shape-rendering="auto">${logo.content}</svg>` : `<image ${box} shape-rendering="auto" preserveAspectRatio="xMidYMid meet" href="${escapeXml(logo.content)}"/>`;
    return plate + art;
  }
  toDataURL(options = {}) {
    return `data:image/svg+xml,${encodeURIComponent(this.toSVG(options))}`;
  }
  toString(options = {}) {
    const margin = options.margin ?? 2;
    const compact = options.compact ?? true;
    const inverse = options.inverse ?? false;
    const isDark = (x, y) => {
      const outside = x < margin || y < margin || x >= this.size + margin || y >= this.size + margin;
      const dark = outside ? false : this.getModule(x - margin, y - margin);
      return inverse ? !dark : dark;
    };
    const width = this.size + margin * 2;
    const height = this.size + margin * 2;
    const lines = [];
    if (!compact) {
      for (let y = 0;y < height; y++) {
        let line = "";
        for (let x = 0;x < width; x++)
          line += isDark(x, y) ? "██" : "  ";
        lines.push(line);
      }
      return lines.join(`
`);
    }
    for (let y = 0;y < height; y += 2) {
      let line = "";
      for (let x = 0;x < width; x++) {
        const top = isDark(x, y);
        const bottom = y + 1 < height ? isDark(x, y + 1) : inverse;
        if (top && bottom)
          line += "█";
        else if (top)
          line += "▀";
        else if (bottom)
          line += "▄";
        else
          line += " ";
      }
      lines.push(line);
    }
    return lines.join(`
`);
  }
}
function buildCodewords(segments, version, level) {
  const capacityBits = dataCodewords(version, level) * 8;
  const bits = new BitBuffer;
  for (const segment of segments)
    writeSegment(segment, version, bits);
  bits.push(0, Math.min(4, capacityBits - bits.length));
  bits.push(0, (8 - bits.length % 8) % 8);
  for (let i = 0;bits.length < capacityBits; i++) {
    bits.push(PAD_CODEWORDS[i % 2], 8);
  }
  const data = bits.toBytes();
  const ecc = eccIndex(level);
  const blockCount = ECC_BLOCKS[ecc]?.[version];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecc]?.[version];
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockLength = Math.floor(totalCodewords / blockCount) - eccPerBlock;
  const longBlockCount = totalCodewords % blockCount;
  const dataBlocks = [];
  const eccBlocks = [];
  for (let i = 0, offset = 0;i < blockCount; i++) {
    const length = shortBlockLength + (i >= blockCount - longBlockCount ? 1 : 0);
    const block = data.subarray(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    eccBlocks.push(encode(block, eccPerBlock));
  }
  const result = new Uint8Array(totalCodewords);
  let index = 0;
  const longestBlock = shortBlockLength + (longBlockCount > 0 ? 1 : 0);
  for (let column = 0;column < longestBlock; column++) {
    for (const block of dataBlocks) {
      if (column < block.length)
        result[index++] = block[column];
    }
  }
  for (let column = 0;column < eccPerBlock; column++) {
    for (const block of eccBlocks)
      result[index++] = block[column];
  }
  return result;
}
function clampVersion(version, name) {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new RangeError(`${name} must be an integer between ${MIN_VERSION} and ${MAX_VERSION}.`);
  }
  return version;
}
var FRAME_SHADES = { top: 0, left: 0.26, right: 0.5, bottom: 1 };
function parseHex(color) {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short !== null) {
    return [0, 1, 2].map((i) => Number.parseInt(short[i + 1].repeat(2), 16));
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (long === null)
    return;
  return [0, 1, 2].map((i) => Number.parseInt(long[i + 1], 16));
}
function mixHex(from, to, ratio) {
  const a = parseHex(from);
  const b = parseHex(to);
  if (a === undefined || b === undefined) {
    throw new RangeError(`a shaded frame needs hexadecimal colors, so "${a === undefined ? from : to}" cannot be used. Pass a single color instead.`);
  }
  const channel = (index) => Math.round(a[index] + (b[index] - a[index]) * ratio).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function renderFrame(frame, band, extent, scale) {
  const fill = frame.fill ?? "#333333";
  const thickness = band * scale;
  const far = extent - thickness;
  let panels;
  if (typeof fill === "string") {
    panels = `<rect width="${extent}" height="${extent}" fill="${escapeXml(fill)}"/>`;
  } else {
    const sides = {
      top: `0,0 ${extent},0 ${far},${thickness} ${thickness},${thickness}`,
      right: `${extent},0 ${extent},${extent} ${far},${far} ${far},${thickness}`,
      bottom: `${extent},${extent} 0,${extent} ${thickness},${far} ${far},${far}`,
      left: `0,${extent} 0,0 ${thickness},${thickness} ${thickness},${far}`
    };
    panels = Object.keys(sides).map((side) => `<polygon points="${sides[side]}" fill="${mixHex(fill.from, fill.to, FRAME_SHADES[side])}"/>`).join("");
  }
  const shared = frame.textColor ?? "#ffffff";
  const family = escapeXml(frame.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
  const fontSize = frame.fontSize === undefined ? thickness * 0.7 : frame.fontSize * scale;
  const label = (value, y, color) => value === undefined ? "" : `<text x="${extent / 2}" y="${y}" fill="${escapeXml(color)}" font-family="${family}" font-size="${fontSize}" ` + `text-anchor="middle" dominant-baseline="central">${escapeXml(value)}</text>`;
  const top = label(frame.title, thickness / 2, frame.titleColor ?? shared);
  const foot = label(frame.caption, extent - thickness / 2, frame.captionColor ?? shared);
  return `<g shape-rendering="auto">${panels}${top}${foot}</g>`;
}
function toSVG(text, options = {}) {
  return QRCode.encode(text, options).toSVG(options);
}
function toDataURL(text, options = {}) {
  return QRCode.encode(text, options).toDataURL(options);
}
function toText(text, options = {}) {
  return QRCode.encode(text, options).toString(options);
}
export {
  ErrorCorrectionLevel,
  MAX_VERSION,
  MIN_VERSION,
  Mode,
  QRCode,
  toDataURL,
  toSVG,
  toText
};
