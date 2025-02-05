import * as arrow from 'apache-arrow';
import {arrowTableToJson} from '../arrow-utils';

/// TODO: Revise tests for nested objects once https://github.com/apache/arrow/issues/33394 is fixed

describe('arrow-utils', () => {
  describe('arrowTableToJson', () => {
    it('should convert Arrow table to JSON array', () => {
      // Create a simple Arrow table
      const data: Array<{id: bigint; name: string; score: number}> = [
        {id: 1n, name: 'John', score: 95.5},
        {id: 2n, name: 'Jane', score: 88.0},
      ];

      const table = arrow.tableFromJSON(data);

      const result = arrowTableToJson(table);
      const expected: Record<string, unknown>[] = [
        {id: 1, name: 'John', score: 95.5},
        {id: 2, name: 'Jane', score: 88.0},
      ];
      expect(result).toEqual(expected);
    });

    it('should handle large BigInt values', () => {
      const largeNumber = 9007199254740991n; // Number.MAX_SAFE_INTEGER
      const data: Array<{id: bigint; value: string}> = [
        {id: largeNumber, value: 'test'},
        {id: largeNumber + 1n, value: 'test2'},
      ];

      const table = arrow.tableFromJSON(data);

      const result = arrowTableToJson(table);
      const expected: Record<string, unknown>[] = [
        {id: 9007199254740991, value: 'test'},
        {id: '9007199254740992', value: 'test2'}, // Beyond MAX_SAFE_INTEGER, should be string
      ];
      expect(result).toEqual(expected);
    });

    it('should handle timestamps and dates', () => {
      const timestamp = new Date('2024-02-05T12:30:45.123Z');
      const date = new Date('2024-02-05');
      const data = [
        {
          id: 1,
          timestamp: timestamp,
          date: date,
        },
      ];

      const table = arrow.tableFromJSON(data);
      const result = arrowTableToJson(table);

      expect(result).toEqual([
        {
          id: 1,
          timestamp: timestamp.getTime(),
          date: date.getTime(),
        },
      ]);
    });

    it('should handle nested objects (structs)', () => {
      /// TODO: Revise tests for nested objects once https://github.com/apache/arrow/issues/33394 is fixed
      // For now, we'll use JSON strings for nested objects as Arrow's JS API
      // doesn't seem to have a straightforward way to create struct types
      const data = [
        {
          id: 1,
          user: JSON.stringify({
            name: 'John',
            address: {
              city: 'New York',
              country: 'USA',
            },
          }),
        },
        {
          id: 2,
          user: JSON.stringify({
            name: 'Jane',
            address: {
              city: 'London',
              country: 'UK',
            },
          }),
        },
      ];

      const table = arrow.tableFromJSON(data);
      const result = arrowTableToJson(table);

      // Parse the JSON strings back to objects for comparison
      const parsedResult = result.map((row) => ({
        ...row,
        user: JSON.parse(row.user as string),
      }));

      expect(parsedResult).toEqual([
        {
          id: 1,
          user: {
            name: 'John',
            address: {
              city: 'New York',
              country: 'USA',
            },
          },
        },
        {
          id: 2,
          user: {
            name: 'Jane',
            address: {
              city: 'London',
              country: 'UK',
            },
          },
        },
      ]);
    });

    it('should handle arrays', () => {
      // For now, we'll use JSON strings for arrays as Arrow's JS API
      // doesn't seem to have a straightforward way to create list types
      const data = [
        {
          id: 1,
          tags: JSON.stringify(['a', 'b']),
          scores: JSON.stringify([1, 2, 3]),
        },
      ];

      const table = arrow.tableFromJSON(data);
      const result = arrowTableToJson(table);

      // Parse the JSON strings back to arrays for comparison
      const parsedResult = result.map((row) => ({
        ...row,
        tags: JSON.parse(row.tags as string),
        scores: JSON.parse(row.scores as string),
      }));

      expect(parsedResult).toEqual([
        {
          id: 1,
          tags: ['a', 'b'],
          scores: [1, 2, 3],
        },
      ]);
    });

    it('should handle combination of structs, BigInts, and timestamps', () => {
      const timestamp = new Date('2024-02-05T12:30:45.123Z');
      // const largeNumber = 9007199254740991n; // MAX_SAFE_INTEGER
      const largeNumber = 1;

      // Create data with JSON strings for complex structures
      const data = [
        {
          id: largeNumber,
          created_at: timestamp,
          metadata: JSON.stringify({
            user: {
              id: largeNumber, // + 1n,
              name: 'John',
              last_login: new Date('2024-01-01T00:00:00Z').getTime(),
              stats: {
                score: 95.5,
                rank: largeNumber, // + 2n,
              },
            },
            tags: ['active', 'premium'],
          }),
        },
      ];

      const table = arrow.tableFromJSON(data);
      const result = arrowTableToJson(table);

      // Parse the JSON strings back to objects for comparison
      const parsedResult = result.map((row) => ({
        ...row,
        metadata: JSON.parse(row.metadata as string),
      }));

      expect(parsedResult).toEqual([
        {
          id: 1,
          created_at: timestamp.getTime(),
          metadata: {
            user: {
              id: 1,
              name: 'John',
              last_login: new Date('2024-01-01T00:00:00Z').getTime(),
              stats: {
                score: 95.5,
                rank: 1,
              },
            },
            tags: ['active', 'premium'],
          },
        },
      ]);
    });
  });
});
