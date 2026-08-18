import {describe, expect, test} from '@jest/globals';
import {Field, Float64, Schema, Table, vectorFromArray} from 'apache-arrow';
import {
  compileLinearScaleAccessor,
  compileLinearScaleExpression,
  createScaleMarker,
} from '../src/json/scaleFunction';
import {compileGeoArrowAccessor} from '../src/json/compileGeoArrowAccessor';

describe('scaleFunction', () => {
  test('createScaleMarker preserves field domain and range', () => {
    expect(
      createScaleMarker({
        field: 'Longitude',
        type: 'linear',
        domain: 'auto',
        range: [0, 200],
      }),
    ).toMatchObject({
      field: 'Longitude',
      type: 'linear',
      domain: 'auto',
      range: [0, 200],
    });
  });

  test('maps domain to range for elevation', () => {
    const table = new Table(
      new Schema([new Field('Longitude', new Float64())]),
      {
        Longitude: vectorFromArray([-124, -122, -120], new Float64()),
      },
    );

    const expression = compileLinearScaleExpression(table, {
      field: 'Longitude',
      domain: 'auto',
      range: [0, 200],
    });
    expect(expression).toBeDefined();

    const accessor = compileGeoArrowAccessor(expression!.slice(3), table);
    const batch = table.batches[0]!;
    expect(accessor({index: 0, data: {data: batch}, target: []})).toBeCloseTo(
      0,
    );
    expect(accessor({index: 1, data: {data: batch}, target: []})).toBeCloseTo(
      100,
    );
    expect(accessor({index: 2, data: {data: batch}, target: []})).toBeCloseTo(
      200,
    );
  });

  test('without range, subtracts domain minimum (legacy)', () => {
    const table = new Table(new Schema([new Field('floors', new Float64())]), {
      floors: vectorFromArray([2, 5, 10], new Float64()),
    });

    const expression = compileLinearScaleExpression(table, {
      field: 'floors',
      domain: 'auto',
    });
    expect(expression).toBe('@@=Math.max(0, floors - 2)');
  });

  test('ignores null values when computing auto domain', () => {
    const values = vectorFromArray([null, 10, 20], new Float64());
    const table = new Table(new Schema([new Field('height', new Float64())]), {
      height: values,
    });

    const expression = compileLinearScaleExpression(table, {
      field: 'height',
      domain: 'auto',
      range: [0, 100],
    });
    expect(expression).toBeDefined();

    const accessor = compileGeoArrowAccessor(expression!.slice(3), table);
    const batch = table.batches[0]!;
    // Domain is [10, 20], not [0, 20] from Number(null).
    expect(accessor({index: 1, data: {data: batch}, target: []})).toBeCloseTo(
      0,
    );
    expect(accessor({index: 2, data: {data: batch}, target: []})).toBeCloseTo(
      100,
    );
  });

  test('does not emit @@= expressions for non-JS-identifier fields', () => {
    const table = new Table(
      new Schema([new Field('Median Income', new Float64())]),
      {
        'Median Income': vectorFromArray([40_000, 80_000], new Float64()),
      },
    );

    expect(
      compileLinearScaleExpression(table, {
        field: 'Median Income',
        domain: 'auto',
        range: [0, 200],
      }),
    ).toBeUndefined();

    const accessor = compileLinearScaleAccessor(table, {
      field: 'Median Income',
      domain: 'auto',
      range: [0, 200],
    });
    expect(accessor).toBeDefined();
    const batch = table.batches[0]!;
    expect(accessor!({index: 0, data: {data: batch}, target: []})).toBeCloseTo(
      0,
    );
    expect(accessor!({index: 1, data: {data: batch}, target: []})).toBeCloseTo(
      200,
    );
  });
});
