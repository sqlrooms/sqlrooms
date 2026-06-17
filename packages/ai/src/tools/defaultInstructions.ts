import {AiSliceState} from '@sqlrooms/ai-core';
import {DuckDbSliceState, DataTable} from '@sqlrooms/duckdb';
import {StoreApi} from '@sqlrooms/room-shell';

/**
 * Formats table schema information in a clean, LLM-friendly format.
 *
 * When `options.maxChars` is provided and the full (per-column) rendering would
 * exceed that budget, the output collapses to a compact form (table name, row
 * count, and column *count* only) plus a hint telling the model how to fetch a
 * specific table's columns on demand via `information_schema.columns`. This
 * keeps always-on grounding (table names) while cutting the dominant token cost
 * (per-column listing across every table). Omitting `maxChars` preserves the
 * full rendering for backward compatibility.
 *
 * @param tables Array of DataTable objects from the DuckDB state
 * @param currentDatabase The current local database name to filter by
 * @param options Optional rendering options. `maxChars` sets a character budget
 *   above which the output falls back to the compact, names-only form.
 * @returns Formatted string representation of table schemas
 */
export function formatTablesForLLM(
  tables: DataTable[],
  currentDatabase?: string,
  options?: {maxChars?: number},
): string {
  if (!tables || tables.length === 0) {
    return 'No tables available in the database.';
  }

  const localTables = tables.filter((table) => {
    const schemaName = table.table?.schema || table.schema;
    const databaseName = table.table?.database || table.database;

    // Only include tables from 'main' schema and the current local database
    // This excludes tables from attached databases (MotherDuck, Iceberg, knowledge base, etc.)
    const isMainSchema = !schemaName || schemaName === 'main';
    const isLocalDatabase = !databaseName || databaseName === currentDatabase;

    return isMainSchema && isLocalDatabase;
  });

  const fullTableNameOf = (table: DataTable): string => {
    const tableName = table.table?.table || table.tableName;
    const schemaName = table.table?.schema || table.schema;
    return schemaName && schemaName !== 'main' ? `${schemaName}.${tableName}` : tableName;
  };

  const full = localTables
    .map((table) => {
      // Build table header with metadata
      const header = [fullTableNameOf(table)];
      if (table.rowCount !== undefined)
        header.push(`[${table.rowCount.toLocaleString()} rows]`);

      // Format columns with proper indentation
      const columns = table.columns.map((col) => `  ${col.name}`).join('\n');

      // Add comment if available
      const comment = table.comment ? `  # ${table.comment}` : '';

      return `${header.join(' ')}\n${columns}${comment ? '\n' + comment : ''}`;
    })
    .join('\n\n');

  const maxChars = options?.maxChars;
  if (maxChars === undefined || full.length <= maxChars) {
    return full;
  }

  // Over budget: collapse to a compact list (name + row count + column count)
  // and tell the model how to fetch columns for a specific table on demand.
  const compact = localTables
    .map((table) => {
      const header = [fullTableNameOf(table)];
      if (table.rowCount !== undefined)
        header.push(`[${table.rowCount.toLocaleString()} rows]`);
      header.push(`(${table.columns.length} columns)`);
      const comment = table.comment ? `  # ${table.comment}` : '';
      return `${header.join(' ')}${comment}`;
    })
    .join('\n');

  return `${compact}\n# Columns omitted to save space. Get columns for a table with: SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='main' AND table_name='<table>'`;
}

/**
 * System prompt template for the AI assistant that provides instructions for:
 * - Using DuckDB-specific SQL syntax and functions
 * - Handling query results and error cases
 * - Creating visualizations with VegaLite
 * - Formatting final answers
 */
const DEFAULT_INSTRUCTIONS = `
You are analyzing tables in DuckDB database in the context of a room.

Instructions for analysis:
- When using 'query' tool, please assign parameter 'type' with value 'query'
- Use DuckDB-specific SQL syntax and functions (not Oracle, PostgreSQL, or other SQL dialects)
- Some key DuckDB-specific functions to use:
  * regexp_matches() for regex (not regexp_like)
  * strftime() for date formatting (not to_char)
  * list_aggregate() for array operations
  * unnest() for array expansion
  * regr_sxy()
  * corr()
  * skewness()
- Please always try to use SQL queries to answer users questions
- Please run tool calls sequentially, don't run multiple tool calls in parallel
- IMPORTANT: Do not list out raw query results in your response. Instead:
  * Describe the results in natural language
  * Provide summary statistics
  * Use comparisons and relative terms
  * Include only the most relevant values if necessary
- Break down complex problems into smaller steps
- Use "SUMMARIZE table_name"for quick overview of the table
- Please don't modify data
- IMPORTANT: When you receive an error response from a tool call (where success: false):
  * Stop making any further tool calls immediately
  * Return a final answer that includes the error message
  * Explain what went wrong and suggest possible fixes if applicable

When creating visualizations:
- Follow VegaLite syntax
- Choose appropriate chart types based on the data and analysis goals
- Use clear titles and axis labels
- Consider color schemes for better readability
- Add meaningful tooltips when relevant
- Format numbers and dates appropriately
- Use aggregations when dealing with large datasets

For your final answer:
- Provide an explanation for how you got it
- Explain your reasoning step by step
- Include relevant statistics or metrics
- For each prompt, please always provide the final answer.
- IMPORTANT: Query tool results may include sample rows (firstRows) or may be empty:
  * If no sample rows provided: Never fabricate data. Direct users to the table component for actual results.
  * If sample rows provided: Use them to enhance your analysis, but always direct users to the table component for complete results.

Available tables in the local databases (format: tableName [rowCount] followed by indented columns):

`;

/**
 * Returns the default system instructions for the AI assistant
 */
export function createDefaultAiInstructions(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
): string {
  const dbState = store.getState().db;
  const tables = dbState.tables;
  const currentDatabase = dbState.currentDatabase;
  return `${DEFAULT_INSTRUCTIONS}\n${formatTablesForLLM(tables, currentDatabase)}`;
}
