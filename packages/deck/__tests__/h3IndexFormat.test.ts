import {describe, expect, test} from '@jest/globals';
import {Int, Int64, Table, Uint64, vectorFromArray} from 'apache-arrow';
import {JSONConverter} from '@deck.gl/json';
import {formatH3IndexForDeck} from '../src/json/layers/h3IndexFormat';
import {createDeckJsonConfiguration} from '../src/json/createDeckJsonConfiguration';
import {prepareDeckDataset} from '../src/prepare/prepareDeckDataset';
import type {PreparedDeckDatasetState} from '../src/types';

describe('formatH3IndexForDeck', () => {
  test('converts bigint cell ids to hex (not decimal String)', () => {
    const cell = 0x882a100d65fffffn;
    // Decimal String(bigint) is NOT a valid H3 hex index for deck.gl.
    expect(String(cell)).toMatch(/^\d+$/);
    expect(String(cell)).not.toBe('882a100d65fffff');
    expect(formatH3IndexForDeck(cell)).toBe('882a100d65fffff');
  });

  test('preserves existing hex strings', () => {
    expect(formatH3IndexForDeck('882a100d65fffff')).toBe('882a100d65fffff');
  });

  test('normalizes signed high-bit Int64 values', () => {
    const unsigned = BigInt('0xffffffffffffffff');
    const signed = BigInt.asIntN(64, unsigned);
    expect(signed < 0n).toBe(true);
    expect(formatH3IndexForDeck(signed)).toBe('ffffffffffffffff');
  });
});

describe('GeoArrowH3HexagonLayer bigint binding', () => {
  function createConverter(
    datasetStates: Record<string, PreparedDeckDatasetState>,
  ) {
    return new JSONConverter({
      configuration: createDeckJsonConfiguration({datasetStates}),
      onJSONChange: () => {},
    });
  }

  test('binds DuckDB-style Int(true,64) H3 column as a Vector', () => {
    // DuckDB UBIGINT often arrives as Int(true, 64), not instanceof Int64.
    const table = new Table({
      h3_cell: vectorFromArray([0x882a100d65fffffn], new Int(true, 64)),
      trip_count: vectorFromArray([12n], new Int64()),
    });
    expect(table.getChild('h3_cell')!.type instanceof Int64).toBe(false);
    expect(table.getChild('h3_cell')!.type instanceof Uint64).toBe(false);

    const prepared = prepareDeckDataset({
      datasetId: 'trip_origins_h3',
      table,
    });
    const converter = createConverter({
      trip_origins_h3: {status: 'ready', prepared},
    });

    const converted = converter.convert({
      layers: [
        {
          '@@type': 'GeoArrowH3HexagonLayer',
          id: 'nyc-origins',
          _sqlroomsBinding: {
            dataset: 'trip_origins_h3',
            hexagonColumn: 'h3_cell',
          },
          getHexagon: '@@=h3_cell',
          getElevation: '@@=trip_count',
          extruded: true,
        },
      ],
    }) as {layers: Array<{props: Record<string, unknown>}>};

    const hex = converted.layers[0]?.props.getHexagon;
    expect(hex).toBeDefined();
    expect(
      formatH3IndexForDeck((hex as {get: (i: number) => unknown}).get(0)),
    ).toBe('882a100d65fffff');
  });
});
