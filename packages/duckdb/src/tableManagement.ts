import * as arrow from 'apache-arrow';
import {DuckDbConnector, DuckQueryExecutionResult} from './types';

/**
 * Create a table from an Arrow table
 */
export async function createTableFromArrowTable(
  tableName: string,
  arrowTable: arrow.Table,
  connector: DuckDbConnector,
): Promise<void> {
  // Register the Arrow table in DuckDB
  const tempName = `temp_arrow_${Date.now()}`;

  // Execute CREATE TABLE command
  await connector.query(`
    CREATE OR REPLACE TABLE ${tableName} AS 
    SELECT * FROM ${tempName}
  `);
}

/**
 * Create a table from an array of JavaScript objects
 */
export async function createTableFromObjects(
  tableName: string,
  objects: Record<string, unknown>[],
  connector: DuckDbConnector,
): Promise<void> {
  if (objects.length === 0) {
    throw new Error('Cannot create a table from an empty array of objects');
  }

  // Convert objects to an Arrow table
  const arrowTable = arrow.tableFromJSON(objects);

  // Create the table from the Arrow table
  await createTableFromArrowTable(tableName, arrowTable, connector);
}

/**
 * Create a table from a SQL query
 */
export async function createTableFromQuery(
  tableName: string,
  query: string,
  connector: DuckDbConnector,
): Promise<{tableName: string; rowCount: number}> {
  // Create the table using the SQL query
  await connector.query(`CREATE OR REPLACE TABLE ${tableName} AS ${query}`);

  // Get the row count
  const countResult = await connector.query(
    `SELECT COUNT(*) FROM ${tableName}`,
  );
  const rowCount = Number(countResult.getChildAt(0)?.get(0));

  return {tableName, rowCount};
}

/**
 * Create a view from a file that's already registered in DuckDB
 */
export async function createViewFromRegisteredFile(
  fileName: string,
  schema: string,
  tableName: string,
  connector: DuckDbConnector,
): Promise<{tableName: string; rowCount: number}> {
  // Create a view from the file
  await connector.query(
    `CREATE OR REPLACE VIEW ${schema}.${tableName} AS SELECT * FROM '${fileName}'`,
  );

  // Get the row count
  const countResult = await connector.query(
    `SELECT COUNT(*) FROM ${schema}.${tableName}`,
  );
  const rowCount = Number(countResult.getChildAt(0)?.get(0));

  return {tableName, rowCount};
}

/**
 * Create a view from a file (URL or File object)
 */
export async function createViewFromFile(
  fileName: string,
  schema: string,
  tableName: string,
  file: File | string,
  connector: DuckDbConnector,
): Promise<{tableName: string; rowCount: number}> {
  // Load the file
  const result = await connector.loadFile(file, tableName);

  return {tableName, rowCount: result.rowCount};
}
