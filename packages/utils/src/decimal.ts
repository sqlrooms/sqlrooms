// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// TODO: Remove this file once Apache Arrow merges the PR below
// https://github.com/apache/arrow-js/pull/341/files#diff-41952a54a60919187ac886be5edde88ec0c80027e2815342d29ec2a77b14d0a6

/**
 * Determine if a decimal value is negative by checking the sign bit.
 * Follows the two's complement representation used in Arrow decimals.
 * @param value The Uint32Array representing the decimal value
 * @returns true if the value is negative, false otherwise
 * @ignore
 */
export function isNegativeDecimal(value: Uint32Array): boolean {
  // Check the sign bit of the most significant 32-bit word
  // This follows the Arrow C++ implementation:
  // https://github.com/apache/arrow/blob/main/cpp/src/arrow/util/basic_decimal.h
  const MAX_INT32 = 2 ** 31 - 1;
  return value.at(-1)! > MAX_INT32;
}

/**
 * Negate a decimal value in-place using two's complement arithmetic.
 * @param value The Uint32Array to negate
 * @returns The negated value (modified in-place for efficiency)
 * @ignore
 */
export function negateDecimal(value: Uint32Array): Uint32Array {
  // Two's complement negation: flip all bits and add 1
  // Follows the Arrow C++ implementation:
  // https://github.com/apache/arrow/blob/main/cpp/src/arrow/util/basic_decimal.cc
  let carry = 1;
  for (let i = 0; i < value.length; i++) {
    const elem = value[i]!;
    const updated = ~elem + carry;
    value[i] = updated >>> 0; // Ensure 32-bit unsigned
    carry &= elem === 0 ? 1 : 0;
  }
  return value;
}

/**
 * Convert a decimal value to a formatted string representation.
 * Handles both Decimal128 (128-bit) and Decimal256 (256-bit) values.
 *
 * @param value The Uint32Array representing the decimal value
 * @param scale The number of decimal places (digits after the decimal point)
 * @returns A string representation of the decimal value
 *
 * @example
 * ```ts
 * import { toDecimalString } from 'apache-arrow';
 *
 * const value = new Uint32Array([1, 0, 0, 0]);
 * const result = toDecimalString(value, 2);
 * // Returns: "0.01"
 * ```
 * @ignore
 */
export function toDecimalString(value: Uint32Array, scale: number): string {
  // Build BigInt from little-endian Uint32 words (supports 128-bit and 256-bit)
  const toBigIntLE = (words: Uint32Array) => {
    let acc = BigInt(0);
    for (let i = 0; i < words.length; i++) {
      acc |= BigInt(words[i]!) << BigInt(32 * i);
    }
    return acc;
  };

  // Detect sign via MSB of most-significant word
  const isNegative = (value[value.length - 1]! & 0x80000000) !== 0;
  // Dynamic width mask (replaces fixed `mask128`)
  const mask = (BigInt(1) << BigInt(value.length * 32)) - BigInt(1);

  const n = toBigIntLE(value);

  // If negative, convert two's complement to magnitude:
  // magnitude = (~n + 1) & mask128
  const magnitude: bigint = isNegative ? (~n + BigInt(1)) & mask : n;

  // Magnitude as decimal string
  const digits = magnitude.toString(10);

  // Special-case: zero
  if (magnitude === BigInt(0)) {
    if (scale === 0) {
      return '0';
    }
    // Tests expect "0.0" for zero with any positive scale
    return '0.0';
  }

  if (scale === 0) {
    const res = digits;
    return isNegative ? '-' + res : res;
  }

  // Ensure we have at least scale digits for fractional part
  let integerPart: string;
  let fracPart: string;
  if (digits.length <= scale) {
    integerPart = '0';
    fracPart = digits.padStart(scale, '0');
  } else {
    const split = digits.length - scale;
    integerPart = digits.slice(0, split);
    fracPart = digits.slice(split);
  }

  // Trim trailing zeros in fractional part
  fracPart = fracPart.replace(/0+$/, '');

  const result = fracPart === '' ? integerPart : integerPart + '.' + fracPart;
  return isNegative ? '-' + result : result;
}

/**
 * Convert a decimal value to a number.
 * Note: This may lose precision for very large decimal values
 * that exceed JavaScript's 53-bit integer precision.
 *
 * @param value The Uint32Array representing the decimal value
 * @param scale The number of decimal places
 * @returns A number representation of the decimal value
 * @ignore
 */
export function toDecimalNumber(value: Uint32Array, scale: number): number {
  const negative = isNegativeDecimal(value);

  // Create a copy to avoid modifying the original
  const valueCopy = new Uint32Array(value);
  if (negative) {
    negateDecimal(valueCopy);
  }

  // Convert to BigInt for calculation
  let num = BigInt(0);
  for (let i = valueCopy.length - 1; i >= 0; i--) {
    num = (num << BigInt(32)) | BigInt(valueCopy[i]!);
  }

  if (negative) {
    num = -num;
  }

  // Apply scale
  if (scale === 0) {
    return Number(num);
  }

  // Calculate divisor as 10^scale
  // Using a loop instead of BigInt exponentiation (**) for ES2015 compatibility
  let divisor = BigInt(1);
  for (let i = 0; i < scale; i++) {
    divisor *= BigInt(10);
  }
  return Number(num) / Number(divisor);
}

/**
 * Create a Decimal128 value from a string representation.
 * @param str String representation (e.g., "123.45")
 * @param scale The scale (number of decimal places) to use
 * @returns Uint32Array representing the decimal value
 *
 * @example
 * ```ts
 * import { fromDecimalString } from 'apache-arrow';
 *
 * const value = fromDecimalString("123.45", 2);
 * // Returns Uint32Array representing 12345 with scale 2
 * ```
 * @ignore
 */
export function fromDecimalString(str: string, scale: number): Uint32Array {
  // Remove leading/trailing whitespace
  str = str.trim();

  // Detect negative
  const negative = str.startsWith('-');
  if (negative) {
    str = str.slice(1);
  }

  // Split on decimal point
  const [wholePart = '0', fracPart = ''] = str.split('.');

  // Pad or truncate fractional part to match scale
  const adjustedFrac = (fracPart + '0'.repeat(scale)).slice(0, scale);
  const intStr = wholePart + adjustedFrac;

  // Convert string to BigInt
  let num = BigInt(intStr);

  // Apply negative if needed
  if (negative) {
    num = -num;
  }

  // Convert BigInt to Uint32Array (Decimal128 = 4 x Uint32)
  const result = new Uint32Array(4);

  if (negative && num !== BigInt(0)) {
    // Use two's complement for negative numbers
    num = -(num + BigInt(1));
    for (let i = 0; i < 4; i++) {
      result[i] = Number((num >> BigInt(i * 32)) & BigInt(0xffffffff));
      result[i] = ~result[i]!;
    }
  } else {
    for (let i = 0; i < 4; i++) {
      result[i] = Number((num >> BigInt(i * 32)) & BigInt(0xffffffff));
    }
  }

  return result;
}
