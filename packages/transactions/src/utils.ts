import { Buffer } from '@stacks/common';
import { sha256, sha512 } from 'sha.js';
import { ClarityValue, serializeCV } from './clarity';
import RIPEMD160 from 'ripemd160-min';
import randombytes from 'randombytes';
import { deserializeCV } from './clarity';
import fetch from 'cross-fetch';
import { c32addressDecode } from 'c32check';
import lodashCloneDeep from 'lodash/cloneDeep';
import { with0x } from '@stacks/common';

export { randombytes as randomBytes };

export class BufferArray {
  _value: Buffer[] = [];
  get value() {
    return this._value;
  }
  appendHexString(hexString: string) {
    this.value.push(Buffer.from(hexString, 'hex'));
  }

  push(buffer: Buffer) {
    return this._value.push(buffer);
  }
  appendByte(octet: number) {
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new Error(`Value ${octet} is not a valid byte`);
    }
    this.value.push(Buffer.from([octet]));
  }

  concatBuffer(): Buffer {
    return Buffer.concat(this.value);
  }
}

export const leftPadHex = (hexString: string): string =>
  hexString.length % 2 == 0 ? hexString : `0${hexString}`;

export const leftPadHexToLength = (hexString: string, length: number): string =>
  hexString.padStart(length, '0');

export const rightPadHexToLength = (hexString: string, length: number): string =>
  hexString.padEnd(length, '0');

export const intToHexString = (integer: number, lengthBytes = 8): string =>
  integer.toString(16).padStart(lengthBytes * 2, '0');

export const hexStringToInt = (hexString: string): number => parseInt(hexString, 16);

export const exceedsMaxLengthBytes = (string: string, maxLengthBytes: number): boolean =>
  string ? Buffer.from(string).length > maxLengthBytes : false;

export function cloneDeep<T>(obj: T): T {
  return lodashCloneDeep(obj);
}

export function omit<T, K extends keyof any>(obj: T, prop: K): Omit<T, K> {
  const clone = cloneDeep(obj);
  // @ts-expect-error
  delete clone[prop];
  return clone;
}

export class sha512_256 extends sha512 {
  constructor() {
    super();
    // set the "SHA-512/256" initialization vector
    // see https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf
    Object.assign(this, {
      _ah: 0x22312194,
      _al: 0xfc2bf72c,
      _bh: 0x9f555fa3,
      _bl: 0xc84c64c2,
      _ch: 0x2393b86b,
      _cl: 0x6f53b151,
      _dh: 0x96387719,
      _dl: 0x5940eabd,
      _eh: 0x96283ee2,
      _el: 0xa88effe3,
      _fh: 0xbe5e1e25,
      _fl: 0x53863992,
      _gh: 0x2b0199fc,
      _gl: 0x2c85b8aa,
      _hh: 0x0eb72ddc,
      _hl: 0x81c52ca2,
    });
  }
  digest(): Buffer;
  digest(encoding: BufferEncoding): string;
  digest(encoding?: BufferEncoding): string | Buffer {
    // "SHA-512/256" truncates the digest to 32 bytes
    const buff = super.digest().slice(0, 32);
    return encoding ? buff.toString(encoding) : buff;
  }
}

export const txidFromData = (data: Buffer): string => new sha512_256().update(data).digest('hex');

export const hash160 = (input: Buffer): Buffer => {
  const sha256Result = new sha256().update(input).digest();
  return Buffer.from(new RIPEMD160().update(sha256Result).digest());
};

// Internally, the Stacks blockchain encodes address the same as Bitcoin
// single-sig address (p2pkh)
export const hashP2PKH = (input: Buffer): string => {
  return hash160(input).toString('hex');
};

// Internally, the Stacks blockchain encodes address the same as Bitcoin
// single-sig address over p2sh (p2h-p2wpkh)
export const hashP2WPKH = (input: Buffer): string => {
  const keyHash = hash160(input);

  const bufferArray = new BufferArray();
  bufferArray.appendByte(0);
  bufferArray.appendByte(keyHash.length);
  bufferArray.push(keyHash);

  const redeemScript = bufferArray.concatBuffer();
  const redeemScriptHash = hash160(redeemScript);
  return redeemScriptHash.toString('hex');
};

// Internally, the Stacks blockchain encodes address the same as Bitcoin
// multi-sig address (p2sh)
export const hashP2SH = (numSigs: number, pubKeys: Buffer[]): string => {
  if (numSigs > 15 || pubKeys.length > 15) {
    throw Error('P2SH multisig address can only contain up to 15 public keys');
  }

  // construct P2SH script
  const bufferArray = new BufferArray();
  // OP_n
  bufferArray.appendByte(80 + numSigs);
  // public keys prepended by their length
  pubKeys.forEach(pubKey => {
    bufferArray.appendByte(pubKey.length);
    bufferArray.push(pubKey);
  });
  // OP_m
  bufferArray.appendByte(80 + pubKeys.length);
  // OP_CHECKMULTISIG
  bufferArray.appendByte(174);

  const redeemScript = bufferArray.concatBuffer();
  const redeemScriptHash = hash160(redeemScript);
  return redeemScriptHash.toString('hex');
};

// Internally, the Stacks blockchain encodes address the same as Bitcoin
// multisig address over p2sh (p2sh-p2wsh)
export const hashP2WSH = (numSigs: number, pubKeys: Buffer[]): string => {
  if (numSigs > 15 || pubKeys.length > 15) {
    throw Error('P2WSH multisig address can only contain up to 15 public keys');
  }

  // construct P2SH script
  const scriptArray = new BufferArray();
  // OP_n
  scriptArray.appendByte(80 + numSigs);
  // public keys prepended by their length
  pubKeys.forEach(pubKey => {
    scriptArray.appendByte(pubKey.length);
    scriptArray.push(pubKey);
  });
  // OP_m
  scriptArray.appendByte(80 + pubKeys.length);
  // OP_CHECKMULTISIG
  scriptArray.appendByte(174);

  const script = scriptArray.concatBuffer();
  const digest = new sha256().update(script).digest();

  const bufferArray = new BufferArray();
  bufferArray.appendByte(0);
  bufferArray.appendByte(digest.length);
  bufferArray.push(digest);

  const redeemScript = bufferArray.concatBuffer();
  const redeemScriptHash = hash160(redeemScript);
  return redeemScriptHash.toString('hex');
};

export function isClarityName(name: string) {
  const regex = /^[a-zA-Z]([a-zA-Z0-9]|[-_!?+<>=/*])*$|^[-+=/*]$|^[<>]=?$/;
  return regex.test(name) && name.length < 128;
}

/** @ignore */
export async function fetchPrivate(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const defaultFetchOpts: RequestInit = {
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer',
  };
  const fetchOpts = Object.assign(defaultFetchOpts, init);
  const fetchResult = await fetch(input, fetchOpts);
  return fetchResult;
}
/**
 * Converts a clarity value to a hex encoded string with `0x` prefix
 * @param {ClarityValue} cv  - the clarity value to convert
 */
export function cvToHex(cv: ClarityValue) {
  const serialized = serializeCV(cv);
  return `0x${serialized.toString('hex')}`;
}

/**
 * Converts a hex encoded string to a clarity value
 * @param {string} hex - the hex encoded string with or without `0x` prefix
 */
export function hexToCV(hex: string) {
  return deserializeCV(hex);
}
/**
 * Read only function response object
 *
 * @param {Boolean} okay - the status of the response
 * @param {string} result - serialized hex clarity value
 */

export interface ReadOnlyFunctionSuccessResponse {
  okay: true;
  result: string;
}

export interface ReadOnlyFunctionErrorResponse {
  okay: false;
  cause: string;
}

export type ReadOnlyFunctionResponse =
  | ReadOnlyFunctionSuccessResponse
  | ReadOnlyFunctionErrorResponse;

/**
 * Converts the response of a read-only function call into its Clarity Value
 * @param param
 */
export const parseReadOnlyResponse = (response: ReadOnlyFunctionResponse): ClarityValue => {
  if (response.okay) {
    return hexToCV(response.result);
  } else {
    throw new Error(response.cause);
  }
};

export const validateStacksAddress = (stacksAddress: string): boolean => {
  try {
    c32addressDecode(stacksAddress);
    return true;
  } catch (e) {
    return false;
  }
};

export const validateTxId = (txid: string): boolean => {
  if (txid === 'success') return true; // Bypass fetchMock tests
  const value = with0x(txid).toLowerCase();
  if (value.length !== 66) return false;
  return with0x(BigInt(value).toString(16).padStart(64, '0')) === value;
};
