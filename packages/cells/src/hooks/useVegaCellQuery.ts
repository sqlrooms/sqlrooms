import {useCellsStore} from '../hooks';
import {wrapQueryWithDateTimeBinning} from '../vegaDateTimeBinning';
import type {VegaCell} from '../types';
import type {YAggregate} from '../vegaDateTimeBinning';
import {readSpecValues} from '../vegaSpecBuilder';
import {detectFieldType} from '../utils';
import {useVegaCellSchema} from './useVegaCellSchema';
import {useVegaCrossFilterOptions} from './useVegaCrossFilterOptions';
import {useVegaCellBaseTable} from './useVegaCellBaseTable';

export interface UseVegaCellQueryParams {
  cell: VegaCell;
}

/**
 * Builds the final SQL query for a Vega cell with optional datetime binning and cross-filter predicates.
 * Handles spec reading, field type detection, and query transformation.
 * Transformation order: base query → datetime binning → cross-filter WHERE clause.
 */
export function useVegaCellQuery(cell: VegaCell): string {
  const baseTable = useVegaCellBaseTable(cell);

  // Step 1: Build base query from table reference
  let selectedSqlQuery = baseTable ? `SELECT * FROM ${baseTable}` : '';

  // Step 2: Apply cross-filter predicate
  selectedSqlQuery = useVegaWrapCrossFilterQuery(selectedSqlQuery, cell);

  // Step 3: Apply datetime binning
  selectedSqlQuery = useVegaWrapDateTimeBinning(selectedSqlQuery, cell);

  return selectedSqlQuery;
}

function useVegaWrapCrossFilterQuery(
  baseQuery: string,
  cell: VegaCell,
): string {
  const {crossFilterPredicate} = useVegaCrossFilterOptions(cell);

  const selectedSqlId = cell.data.sqlId;
  // Subscribe to cross-filter selections to trigger re-render when siblings change
  const crossFilterGroup = useCellsStore((s) =>
    selectedSqlId ? s.cells.crossFilterSelections[selectedSqlId] : undefined,
  );

  // Explicitly document why this dependency is needed but unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _forceRerenderOnCrossFilterChange = crossFilterGroup;

  if (crossFilterPredicate && baseQuery) {
    return `SELECT * FROM (${baseQuery}) AS _cells_base WHERE ${crossFilterPredicate}`;
  }

  return baseQuery;
}

function useVegaWrapDateTimeBinning(baseQuery: string, cell: VegaCell): string {
  const specValues = readSpecValues(cell.data.vegaSpec);

  const {xField, yAggregate, yField} = specValues;
  const {xTimeScale} = cell.data;

  // Extract spec values from Vega spec
  const {fields} = useVegaCellSchema(cell);

  // Detect field type from queried schema
  const xFieldType =
    specValues.xField && fields
      ? detectFieldType(specValues.xField, {schema: {fields}})
      : undefined;

  const shouldApplyDateTimeBinning =
    xField && xTimeScale !== 'none' && xFieldType === 'temporal' && yAggregate;

  // Apply datetime binning if conditions are met and query exists
  if (shouldApplyDateTimeBinning && baseQuery) {
    return wrapQueryWithDateTimeBinning(
      baseQuery,
      xField!,
      xTimeScale,
      yField,
      yAggregate as YAggregate,
    );
  }

  return baseQuery;
}
