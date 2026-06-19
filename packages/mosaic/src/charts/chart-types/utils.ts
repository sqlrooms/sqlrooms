import {DataTable} from '@sqlrooms/db';
import {ChartTypeDefinition} from './base-types';

/**
 * Builds an unquoted table reference string for use with vgPlot/Mosaic specs.
 *
 * Returns a dot-separated string (e.g., "database.schema.table" or just "table")
 * without SQL quotes, which vgPlot requires for table references.
 *
 * @param dataTable - The data table containing qualified table name information
 * @returns Unquoted table reference string
 */
export function getChartTableReference(dataTable: DataTable): string {
  if (dataTable.table.database && dataTable.table.schema) {
    return `${dataTable.table.database}.${dataTable.table.schema}.${dataTable.table.table}`;
  }

  return dataTable.table.table;
}

export function getChartToolName(
  chartType: ChartTypeDefinition<any>,
  toolNamePrefix: string,
): string {
  return `${toolNamePrefix}${chartType.id.replace(/-/g, '_')}`;
}
