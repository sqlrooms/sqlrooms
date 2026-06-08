import {describe, it, expect} from '@jest/globals';
import {
  validateFieldExists,
  getValidatedColumn,
  validateAggregation,
} from '../src/charts/chart-types/validation';
import {ChartSpecError} from '../src/charts/chart-types/errors';
import type {DataTable} from '@sqlrooms/db';

const mockDataTable: DataTable = {
  table: {table: 'test_table'},
  columns: [
    {name: 'id', type: 'INTEGER'},
    {name: 'name', type: 'VARCHAR'},
    {name: 'price', type: 'DECIMAL'},
    {name: 'created_at', type: 'TIMESTAMP'},
  ],
} as DataTable;

describe('validation', () => {
  describe('validateFieldExists', () => {
    it('should not throw for existing field', () => {
      expect(() =>
        validateFieldExists(mockDataTable, 'id', 'Test field'),
      ).not.toThrow();
    });

    it('should throw for non-existing field', () => {
      expect(() =>
        validateFieldExists(mockDataTable, 'nonexistent', 'Test field'),
      ).toThrow(ChartSpecError);
      expect(() =>
        validateFieldExists(mockDataTable, 'nonexistent', 'Test field'),
      ).toThrow('Test field "nonexistent" not found in data table');
    });
  });

  describe('getValidatedColumn', () => {
    it('should return column for existing field', () => {
      const column = getValidatedColumn(mockDataTable, 'price', 'Price field');
      expect(column).toEqual({name: 'price', type: 'DECIMAL'});
    });

    it('should throw for non-existing field', () => {
      expect(() =>
        getValidatedColumn(mockDataTable, 'nonexistent', 'Test field'),
      ).toThrow(ChartSpecError);
    });
  });

  describe('validateAggregation', () => {
    it('should not throw for numeric field with aggregation', () => {
      expect(() =>
        validateAggregation(mockDataTable, 'price', 'sum', 'Price field'),
      ).not.toThrow();
      expect(() =>
        validateAggregation(mockDataTable, 'id', 'avg', 'ID field'),
      ).not.toThrow();
    });

    it('should throw for non-numeric field with aggregation', () => {
      expect(() =>
        validateAggregation(mockDataTable, 'name', 'sum', 'Name field'),
      ).toThrow(ChartSpecError);
      expect(() =>
        validateAggregation(mockDataTable, 'name', 'sum', 'Name field'),
      ).toThrow(
        'Aggregation "sum" cannot be applied to non-numeric field "name" (type: VARCHAR)',
      );
    });

    it('should throw for non-existing field', () => {
      expect(() =>
        validateAggregation(mockDataTable, 'nonexistent', 'sum', 'Test field'),
      ).toThrow(ChartSpecError);
    });
  });
});
