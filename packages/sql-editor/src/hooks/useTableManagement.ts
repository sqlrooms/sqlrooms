import {
  escapeId,
  getDuckTables,
  getDuckTableSchemas,
  useDuckDb,
} from '@sqlrooms/duckdb';
import {useCallback, useState, useEffect} from 'react';

/**
 * Hook to manage SQL tables, their schemas, and sample data
 */
export function useTableManagement(schema: string = 'main') {
  const duckConn = useDuckDb();
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<Error | null>(null);
  const [tableSchemas, setTableSchemas] = useState<
    Record<string, Record<string, string>>
  >({});
  const [tableSamples, setTableSamples] = useState<Record<string, string[]>>(
    {},
  );
  const [selectedTable, setSelectedTable] = useState<string>();

  const fetchTables = useCallback(async () => {
    if (!duckConn.conn) return;

    try {
      setTablesLoading(true);
      setTablesError(null);

      // Get all tables and their schemas using the utility functions
      const tablesList = await getDuckTables(schema);
      setTables(tablesList);

      // Get detailed table schemas
      const tablesData = await getDuckTableSchemas(schema);

      // Convert to the format expected by SqlMonacoEditor
      const schemas: Record<string, Record<string, string>> = {};
      const samples: Record<string, string[]> = {};

      // Process each table's schema
      for (const tableData of tablesData) {
        const {tableName, columns} = tableData;
        const columnMap: Record<string, string> = {};

        // Add each column to the map
        for (const column of columns) {
          columnMap[column.name] = column.type;
        }

        schemas[tableName] = columnMap;

        // Skip tables with too many columns to avoid performance issues
        if (columns.length > 20) {
          samples[tableName] = [
            `Table has ${columns.length} columns - samples omitted for performance`,
          ];
          continue;
        }

        try {
          // Set a timeout to prevent hanging
          const samplePromise = new Promise<any[]>(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Timeout fetching samples for ${tableName}`));
            }, 1000); // 1 second timeout

            try {
              // Limit to 3 rows for samples
              const result = await duckConn.conn.query(
                `SELECT * FROM ${schema}.${escapeId(tableName)} LIMIT 3`,
              );
              clearTimeout(timeoutId);
              resolve(result.toArray());
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error);
            }
          });

          const result = await samplePromise;

          if (result && result.length > 0) {
            const columnNames = Object.keys(columnMap);
            const tableSamples: string[] = [];

            // Create sample strings for each row
            for (const row of result) {
              for (const colName of columnNames) {
                let value = row[colName];

                // Format the value based on its type
                if (value === null || value === undefined) {
                  value = 'NULL';
                } else if (typeof value === 'string') {
                  // Truncate long strings
                  value =
                    value.length > 50 ? value.substring(0, 47) + '...' : value;
                  value = `'${value}'`;
                } else if (typeof value === 'object') {
                  value = JSON.stringify(value);
                  // Truncate long JSON
                  value =
                    value.length > 50 ? value.substring(0, 47) + '...' : value;
                }

                tableSamples.push(`${colName}: ${value}`);
              }

              // Add a separator between rows if we have more than one
              if (
                result.length > 1 &&
                tableSamples.length < columnNames.length * result.length
              ) {
                tableSamples.push('---');
              }
            }

            samples[tableName] = tableSamples;
          }
        } catch (error) {
          console.error(`Error fetching samples for ${tableName}:`, error);
          samples[tableName] = [
            `Error fetching samples: ${(error as Error).message}`,
          ];
        }
      }

      setTableSchemas(schemas);
      setTableSamples(samples);
    } catch (error) {
      console.error('Error fetching tables:', error);
      setTablesError(error as Error);
    } finally {
      setTablesLoading(false);
    }
  }, [duckConn.conn, schema]);

  const handleSelectTable = (table: string) => {
    setSelectedTable(table);
  };

  useEffect(() => {
    if (duckConn.conn) {
      void fetchTables();
    } else {
      console.error('No DuckDB connection available');
    }
  }, [fetchTables, duckConn.conn]);

  return {
    tables,
    tablesLoading,
    tablesError,
    tableSchemas,
    tableSamples,
    selectedTable,
    fetchTables,
    handleSelectTable,
  };
}
