import {DataTable, escapeId, escapeVal} from '@sqlrooms/duckdb';
import {getAggregatorLabel, getPivotAggregator} from './aggregators';
import {PivotSliceConfig, PivotValueFilter} from './types';

const NULL_LABEL = 'null';

function getTableReference(table: DataTable) {
  return table.table.toString();
}

function getDimensionValueSql(field: string) {
  return `COALESCE(CAST(${escapeId(field)} AS VARCHAR), ${escapeVal(NULL_LABEL)})`;
}

function buildFilterClause(config: PivotSliceConfig) {
  const predicates = Object.entries(config.valueFilter as PivotValueFilter)
    .filter(([, values]) => Object.keys(values).length > 0)
    .map(([field, values]) => {
      const excludedValues = Object.keys(values);
      const valueExpression = getDimensionValueSql(field);
      return `${valueExpression} NOT IN (${excludedValues
        .map((value) => escapeVal(value))
        .join(', ')})`;
    });

  if (predicates.length === 0) {
    return '';
  }

  return `WHERE ${predicates.join(' AND ')}`;
}

function buildDimensionMetadata(fields: string[], prefix: 'row' | 'col') {
  return fields.map((field, index) => ({
    field,
    alias: `${prefix}_${index}`,
    expression: getDimensionValueSql(field),
  }));
}

function buildDimensionSelects(
  metadata: ReturnType<typeof buildDimensionMetadata>,
) {
  return metadata.map(
    (item) => `${item.expression} AS ${escapeId(item.alias)}`,
  );
}

function buildDimensionGroupBy(
  metadata: ReturnType<typeof buildDimensionMetadata>,
) {
  return metadata.map((item) => item.expression);
}

function buildConcatLabelSql(
  metadata: ReturnType<typeof buildDimensionMetadata>,
) {
  if (metadata.length === 0) {
    return `${escapeVal('')}`;
  }
  return `CONCAT_WS(' / ', ${metadata.map((item) => item.expression).join(', ')})`;
}

function buildBaseAggregateSql(config: PivotSliceConfig) {
  const aggregator = getPivotAggregator(config.aggregatorName);
  return aggregator.buildSql(config.vals.slice(0, aggregator.numInputs));
}

function buildOrderByAliases(
  metadata: ReturnType<typeof buildDimensionMetadata>,
  sortOrder: PivotSliceConfig['rowOrder'],
) {
  if (sortOrder !== 'key_a_to_z') {
    return [] as string[];
  }
  return metadata.map((item) => escapeId(item.alias));
}

export function buildCellsQuery(config: PivotSliceConfig, table: DataTable) {
  const aggregator = getPivotAggregator(config.aggregatorName);
  const tableRef = getTableReference(table);
  const rowMetadata = buildDimensionMetadata(config.rows, 'row');
  const colMetadata = buildDimensionMetadata(config.cols, 'col');
  const allMetadata = [...rowMetadata, ...colMetadata];
  const filterClause = buildFilterClause(config);
  const baseAggregateSql = buildBaseAggregateSql(config);
  const groupBy = buildDimensionGroupBy(allMetadata);
  const orderBy = [
    ...buildOrderByAliases(rowMetadata, config.rowOrder),
    ...buildOrderByAliases(colMetadata, config.colOrder),
  ];
  const selectList = [
    ...buildDimensionSelects(rowMetadata),
    ...buildDimensionSelects(colMetadata),
    `${buildConcatLabelSql(rowMetadata)} AS ${escapeId('row_label')}`,
    `${buildConcatLabelSql(colMetadata)} AS ${escapeId('col_label')}`,
  ];

  if (aggregator.kind === 'default') {
    return `WITH filtered AS (
  SELECT *
  FROM ${tableRef}
  ${filterClause}
)
SELECT
  ${[...selectList, `${baseAggregateSql} AS ${escapeId('value')}`].join(',\n  ')}
FROM filtered
${groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : ''}
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
  }

  const partitionMetadata =
    aggregator.kind === 'fraction_row'
      ? rowMetadata
      : aggregator.kind === 'fraction_col'
        ? colMetadata
        : [];

  const partitionBy =
    partitionMetadata.length > 0
      ? `PARTITION BY ${partitionMetadata
          .map((item) => escapeId(item.alias))
          .join(', ')}`
      : '';

  return `WITH filtered AS (
  SELECT *
  FROM ${tableRef}
  ${filterClause}
),
grouped AS (
  SELECT
    ${[...selectList, `${baseAggregateSql} AS ${escapeId('base_value')}`].join(',\n    ')}
  FROM filtered
  ${groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : ''}
)
SELECT
  ${[
    ...rowMetadata.map((item) => escapeId(item.alias)),
    ...colMetadata.map((item) => escapeId(item.alias)),
    escapeId('row_label'),
    escapeId('col_label'),
    `${escapeId('base_value')} / NULLIF(SUM(${escapeId('base_value')}) OVER (${partitionBy}), 0) AS ${escapeId('value')}`,
  ].join(',\n  ')}
FROM grouped
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
}

function buildAxisTotalsQuery(
  config: PivotSliceConfig,
  table: DataTable,
  axis: 'row' | 'col' | 'grand',
) {
  const aggregator = getPivotAggregator(config.aggregatorName);
  const tableRef = getTableReference(table);
  const rowMetadata = buildDimensionMetadata(config.rows, 'row');
  const colMetadata = buildDimensionMetadata(config.cols, 'col');
  const metadata =
    axis === 'row'
      ? rowMetadata
      : axis === 'col'
        ? colMetadata
        : ([] as typeof rowMetadata);
  const filterClause = buildFilterClause(config);
  const baseAggregateSql = buildBaseAggregateSql(config);

  if (axis === 'grand') {
    if (aggregator.kind === 'default') {
      return `SELECT ${baseAggregateSql} AS ${escapeId('value')}
FROM ${tableRef}
${filterClause}`;
    }
    return `SELECT 1.0 AS ${escapeId('value')}`;
  }

  const axisSelects = [
    ...buildDimensionSelects(metadata),
    `${buildConcatLabelSql(metadata)} AS ${escapeId(`${axis}_label`)}`,
  ];
  const groupBy = buildDimensionGroupBy(metadata);
  const orderBy = buildOrderByAliases(
    metadata,
    axis === 'row' ? config.rowOrder : config.colOrder,
  );

  if (aggregator.kind === 'default') {
    return `SELECT
  ${[...axisSelects, `${baseAggregateSql} AS ${escapeId('value')}`].join(',\n  ')}
FROM ${tableRef}
${filterClause}
${groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : ''}
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
  }

  if (
    (aggregator.kind === 'fraction_row' && axis === 'row') ||
    (aggregator.kind === 'fraction_col' && axis === 'col')
  ) {
    return `SELECT
  ${[...axisSelects, `1.0 AS ${escapeId('value')}`].join(',\n  ')}
FROM ${tableRef}
${filterClause}
${groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : ''}
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
  }

  return `WITH totals AS (
  SELECT
    ${[...axisSelects, `${baseAggregateSql} AS ${escapeId('base_value')}`].join(',\n    ')}
  FROM ${tableRef}
  ${filterClause}
  ${groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}` : ''}
),
grand_total AS (
  SELECT ${baseAggregateSql} AS ${escapeId('grand_value')}
  FROM ${tableRef}
  ${filterClause}
)
SELECT
  ${[
    ...metadata.map((item) => escapeId(item.alias)),
    escapeId(`${axis}_label`),
    `${escapeId('base_value')} / NULLIF(${escapeId('grand_value')}, 0) AS ${escapeId('value')}`,
  ].join(',\n  ')}
FROM totals
CROSS JOIN grand_total
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
}

export function buildRowTotalsQuery(
  config: PivotSliceConfig,
  table: DataTable,
) {
  return buildAxisTotalsQuery(config, table, 'row');
}

export function buildColTotalsQuery(
  config: PivotSliceConfig,
  table: DataTable,
) {
  return buildAxisTotalsQuery(config, table, 'col');
}

export function buildGrandTotalQuery(
  config: PivotSliceConfig,
  table: DataTable,
) {
  return buildAxisTotalsQuery(config, table, 'grand');
}

export function buildDistinctValuesQuery(
  table: DataTable,
  attribute: string,
  menuLimit: number,
) {
  const tableRef = getTableReference(table);
  const valueExpression = getDimensionValueSql(attribute);
  return `SELECT
  ${valueExpression} AS ${escapeId('value')},
  COUNT(*) AS ${escapeId('count')}
FROM ${tableRef}
GROUP BY 1
ORDER BY 1
LIMIT ${menuLimit + 1}`;
}

export function buildPivotExportQuery(
  config: PivotSliceConfig,
  table: DataTable,
  colKeys: string[],
) {
  const rowMetadata = buildDimensionMetadata(config.rows, 'row');
  const cellsQuery = buildCellsQuery(config, table);
  const orderBy = buildOrderByAliases(rowMetadata, config.rowOrder);

  if (colKeys.length === 0) {
    return `WITH cells AS (
${indentSql(cellsQuery)}
)
SELECT
  ${[
    ...rowMetadata.map((item) => escapeId(item.alias)),
    `${escapeId('value')} AS ${escapeId(getAggregatorLabel(config.aggregatorName, config.vals))}`,
  ].join(',\n  ')}
FROM cells`;
  }

  return `WITH cells AS (
${indentSql(cellsQuery)}
)
SELECT *
FROM (
  SELECT
    ${[
      ...rowMetadata.map((item) => escapeId(item.alias)),
      escapeId('col_label'),
      escapeId('value'),
    ].join(',\n    ')}
  FROM cells
)
PIVOT(
  MAX(${escapeId('value')})
  FOR ${escapeId('col_label')} IN (${colKeys.map((key) => escapeVal(key)).join(', ')})
)
${orderBy.length > 0 ? `ORDER BY ${orderBy.join(', ')}` : ''}`;
}

export function buildRendererTitle(
  config: PivotSliceConfig,
  transpose = false,
) {
  const fullAggName = getAggregatorLabel(config.aggregatorName, config.vals);
  const axisTitle = transpose ? config.rows.join(', ') : config.cols.join(', ');
  const groupByTitle = transpose
    ? config.cols.join(', ')
    : config.rows.join(', ');
  let title = fullAggName;
  if (axisTitle) {
    title += ` vs ${axisTitle}`;
  }
  if (groupByTitle) {
    title += ` by ${groupByTitle}`;
  }
  return title;
}

function indentSql(sql: string) {
  return sql
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

export function getRowAlias(index: number) {
  return `row_${index}`;
}

export function getColAlias(index: number) {
  return `col_${index}`;
}

export function getNullLabel() {
  return NULL_LABEL;
}
