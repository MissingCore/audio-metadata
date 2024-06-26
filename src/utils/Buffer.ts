/* eslint-disable no-bitwise */
import 'fast-text-encoding';

/**
 * List of character set encodings.
 *  - `0`: `ISO-8859-1`
 *  - `1`: `UTF-16 w/ BOM`
 *  - `2`: `UTF-16BE w/o BOM` (used in ID3v2.4)
 *  - `3`: `UTF-8` (used in ID3v2.4)
 */
export type Encoding = 0 | 1 | 2 | 3;

/** Subclass of Uint8Array (unsigned bytes). */
export class Buffer {
  #buffer: Uint8Array = new Uint8Array();
  #cursor = 0;

  /** Set the buffer and reset the cursor. */
  setBuffer(buffer: Uint8Array, offset = 0) {
    this.#buffer = buffer;
    this.#cursor = offset;
  }

  /** Get stored buffer. */
  get buffer() {
    return this.#buffer;
  }

  /** Whether the current position is at the end of the buffer. */
  get eof() {
    return this.#cursor >= this.length;
  }

  /** Length/size of the buffer. */
  get length() {
    return this.#buffer.length;
  }

  /** Current buffer cursor position. */
  get position() {
    return this.#cursor;
  }

  /** Move cursor by offset, returning the amount traversed. */
  move(offset: number) {
    const start = this.#cursor;
    this.#cursor = start + offset > this.length ? this.length : start + offset;
    return this.#cursor - start; // "Ending Position" - "Prev Position"
  }

  /** Reads 1 byte and increment cursor. */
  readUInt8() {
    return this.#buffer[this.#cursor++];
  }

  /** Read the specified number of bytes, or the amount until we hit the `eof`. */
  readBytes(length: number) {
    const start = this.#cursor;
    return [...this.#buffer.slice(start, start + this.move(length))];
  }

  /**
   * Convert a base64 string to a Typed Array (unsigned byte array).
   *  - Uint8Array is better for runtime performance
   */
  static base64ToBuffer(base64: string) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  /** Represent byte as binary. */
  static byteToBinary(byte: number) {
    return byte.toString(2).padStart(8, '0');
  }

  /** Convert bytes into a base64 string. */
  static bytesToBase64(bytes: number[]) {
    return btoa(bytes.reduce((s, byte) => s + String.fromCharCode(byte), ''));
  }

  /**
   * Convert bytes into an integer, allows for limiting the numbers of
   * bits read in a byte (ie: `bitsUsed = 7` would read as a synchsafe
   * integer).
   *  - Defaults: `bitsUsed = 8`, `bigEndian = true`
   */
  static bytesToInt(bytes: number[], bitsUsed = 8, bigEndian = true) {
    const bytesCpy = [...bytes];
    // By default, bytes are read from left to right, resulting in little
    // endian format. To read in big endian, we need to reverse the array.
    if (bigEndian) bytesCpy.reverse();
    return bytesCpy.reduce(
      (num, byte, idx) => (num |= byte << (idx * bitsUsed)),
      0
    );
  }

  /** Convert bytes into a string based on an encoding. */
  static bytesToString(bytes: number[], encoding: Encoding = 0) {
    switch (encoding) {
      /* [UTF-16 w/ BOM] — Big Endian if starts with [0xFE, 0xFF] */
      case 1: {
        const isBE = bytes[0] === 0xfe && bytes[1] === 0xff;
        // Remove the "Byte-order mark" [255, 254] or [254, 255] at the start.
        return _bytesToStr(_getDoubleBytes(bytes.slice(2), isBE));
      }
      /* [UTF-16BE w/o BOM] — Always Big Endian */
      case 2:
        return _bytesToStr(_getDoubleBytes(bytes, true));
      /* [UTF-8] */
      case 3: {
        const tdInstant = new TextDecoder();
        // Make sure to remove null byte (`\u0000`) at end of string to
        // make equality tests work as expected.
        return tdInstant.decode(Uint8Array.from(bytes)).replace(/\0.*$/g, '');
      }
      /* [ISO-8859-1] — Only ASCII printable characters */
      default:
        return _bytesToStr(bytes);
    }
  }

  /** Reads a range of bits in a byte (in Big Endian). */
  static readBitsInByte(byte: number, start: number, length: number) {
    const binary = this.byteToBinary(byte);
    const range = binary.slice(start, start + length);
    return parseInt(range.padStart(8, '0'), 2);
  }
}

/** Turn an array of bytes into a string. */
function _bytesToStr(bytes: number[]) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) break;
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

/** Join 2 unsigned bytes together based on endianness. */
function _getDoubleBytes(bytes: number[], isBigEndian = false) {
  const [offset1, offset2] = isBigEndian ? [0, 1] : [1, 0];
  const doubleBytes: number[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    // Since we're joining unsigned numbers, we don't need to add `& 0xFF`
    // to the bytes before we do any operations.
    doubleBytes.push((bytes[i + offset1] << 8) | bytes[i + offset2]);
  }
  return doubleBytes;
}
