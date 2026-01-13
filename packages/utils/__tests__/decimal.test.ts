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

// TODO: Remove this file and test cases once Apache Arrow exposes a stable helper for this
// https://github.com/apache/arrow-js/pull/341/files#diff-41952a54a60919187ac886be5edde88ec0c80027e2815342d29ec2a77b14d0a6

import {
  isNegativeDecimal,
  negateDecimal,
  toDecimalString,
  toDecimalNumber,
  fromDecimalString,
} from '../src/decimal';

describe('Decimal Utilities', () => {
  describe('isNegativeDecimal', () => {
    test('returns false for positive values', () => {
      const positive = new Uint32Array([1, 0, 0, 0]);
      expect(isNegativeDecimal(positive)).toBe(false);
    });

    test('returns false for zero', () => {
      const zero = new Uint32Array([0, 0, 0, 0]);
      expect(isNegativeDecimal(zero)).toBe(false);
    });

    test('returns true for negative values (sign bit set)', () => {
      // Sign bit set: MSB of the most significant word is 1
      const negative = new Uint32Array([0, 0, 0, 0x80000000]);
      expect(isNegativeDecimal(negative)).toBe(true);
    });

    test("returns true for -1 in two's complement", () => {
      const minusOne = new Uint32Array([
        0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
      ]);
      expect(isNegativeDecimal(minusOne)).toBe(true);
    });
  });

  describe('negateDecimal', () => {
    test('negates positive values correctly', () => {
      const positive = new Uint32Array([1, 0, 0, 0]);
      const result = negateDecimal(new Uint32Array(positive));
      expect(isNegativeDecimal(result)).toBe(true);
    });

    test('negates negative values back to positive', () => {
      const negative = new Uint32Array([
        0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
      ]);
      const result = negateDecimal(new Uint32Array(negative));
      expect(isNegativeDecimal(result)).toBe(false);
      expect(result[0]).toBe(1);
    });

    test('zero remains zero when negated', () => {
      const zero = new Uint32Array([0, 0, 0, 0]);
      const result = negateDecimal(new Uint32Array(zero));
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(0);
    });

    test('modifies array in-place', () => {
      const arr = new Uint32Array([1, 0, 0, 0]);
      const result = negateDecimal(arr);
      expect(result).toBe(arr);
    });
  });

  describe('toDecimalString', () => {
    test('converts small positive integer with scale 0', () => {
      const value = new Uint32Array([42, 0, 0, 0]);
      const result = toDecimalString(value, 0);
      expect(result).toBe('42');
    });

    test('converts small positive integer with scale', () => {
      const value = new Uint32Array([12345, 0, 0, 0]);
      const result = toDecimalString(value, 2);
      expect(result).toBe('123.45');
    });

    test('handles scale larger than integer', () => {
      const value = new Uint32Array([42, 0, 0, 0]);
      const result = toDecimalString(value, 5);
      expect(result).toBe('0.00042');
    });

    test('removes trailing zeros', () => {
      const value = new Uint32Array([1000, 0, 0, 0]);
      const result = toDecimalString(value, 2);
      expect(result).toBe('10');
    });

    test('formats negative values with minus sign', () => {
      // -42 in two's complement
      const negative = new Uint32Array([
        0xffffffd6, 0xffffffff, 0xffffffff, 0xffffffff,
      ]);
      const result = toDecimalString(negative, 0);
      expect(result.startsWith('-')).toBe(true);
    });

    test('handles zero correctly', () => {
      const zero = new Uint32Array([0, 0, 0, 0]);
      expect(toDecimalString(zero, 0)).toBe('0');
      expect(toDecimalString(zero, 2)).toBe('0.0');
    });
  });

  describe('toDecimalNumber', () => {
    test('converts small positive integer', () => {
      const value = new Uint32Array([42, 0, 0, 0]);
      const result = toDecimalNumber(value, 0);
      expect(result).toBe(42);
    });

    test('applies scale correctly', () => {
      const value = new Uint32Array([12345, 0, 0, 0]);
      const result = toDecimalNumber(value, 2);
      expect(result).toBeCloseTo(123.45);
    });

    test('handles scale 0', () => {
      const value = new Uint32Array([100, 0, 0, 0]);
      const result = toDecimalNumber(value, 0);
      expect(result).toBe(100);
    });

    test('converts zero', () => {
      const zero = new Uint32Array([0, 0, 0, 0]);
      expect(toDecimalNumber(zero, 0)).toBe(0);
      expect(toDecimalNumber(zero, 2)).toBe(0);
    });

    test('does not modify original array', () => {
      const value = new Uint32Array([42, 0, 0, 0]);
      const original = new Uint32Array(value);
      toDecimalNumber(value, 2);
      expect(value).toEqual(original);
    });
  });

  describe('fromDecimalString', () => {
    test('parses positive integer string', () => {
      const result = fromDecimalString('42', 0);
      expect(result[0]).toBe(42);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(0);
    });

    test('parses decimal string with scale', () => {
      const result = fromDecimalString('123.45', 2);
      expect(result[0]).toBe(12345);
    });

    test('parses negative numbers', () => {
      const result = fromDecimalString('-42', 0);
      expect(isNegativeDecimal(result)).toBe(true);
    });

    test('pads fractional part to match scale', () => {
      const result = fromDecimalString('12.3', 3);
      expect(result[0]).toBe(12300);
    });

    test('truncates fractional part to match scale', () => {
      const result = fromDecimalString('123.456', 2);
      expect(result[0]).toBe(12345);
    });

    test('handles missing fractional part', () => {
      const result = fromDecimalString('123', 2);
      expect(result[0]).toBe(12300);
    });

    test('handles whitespace', () => {
      const result = fromDecimalString('  42  ', 0);
      expect(result[0]).toBe(42);
    });

    test('parses zero', () => {
      const result = fromDecimalString('0', 2);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(0);
    });

    test('roundtrip: string -> decimal -> string', () => {
      const original = '123.45';
      const scale = 2;
      const decimal = fromDecimalString(original, scale);
      const result = toDecimalString(decimal, scale);
      expect(result).toBe(original);
    });

    test('roundtrip: negative string -> decimal -> string', () => {
      const original = '-123.45';
      const scale = 2;
      const decimal = fromDecimalString(original, scale);
      const result = toDecimalString(decimal, scale);
      expect(result).toBe(original);
    });
  });

  describe('Integration tests', () => {
    test('converts decimal string to number and back', () => {
      const original = '99.99';
      const scale = 2;
      const decimal = fromDecimalString(original, scale);
      const num = toDecimalNumber(decimal, scale);
      const str = toDecimalString(decimal, scale);
      expect(num).toBeCloseTo(99.99);
      expect(str).toBe(original);
    });

    test('negation preserves magnitude', () => {
      const positive = fromDecimalString('42.50', 2);
      const negated = negateDecimal(new Uint32Array(positive));
      const posStr = toDecimalString(positive, 2);
      const negStr = toDecimalString(negated, 2);
      expect(negStr).toBe('-' + posStr);
    });

    test('double negation returns to original', () => {
      const original = fromDecimalString('123.45', 2);
      const negated = negateDecimal(new Uint32Array(original));
      const doubleNegated = negateDecimal(new Uint32Array(negated));
      expect(toDecimalString(doubleNegated, 2)).toBe(
        toDecimalString(original, 2),
      );
    });
  });
});
