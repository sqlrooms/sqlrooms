import type {Extension} from '@codemirror/state';
import {
  DataTable,
  DuckDbConnector,
  getFunctionSuggestions,
  getFunctionDocumentation,
} from '@sqlrooms/duckdb';
import {createDuckDbSql, SqlRoomsDuckDBDialect} from './duckdb-sql';
import {convertToSQLNamespace} from '../../utils/schema-converter';
import {createCompletion} from '../completion';
import {createDuckDbSqlExtension} from './duckdb-sql-extension';
import {createHover} from '../hover';

type DuckDbExtensionOptions = {
  currentSchemas: DataTable[];
  connector?: DuckDbConnector;
};

export function createDuckDbExtension({
  currentSchemas,
  connector,
}: DuckDbExtensionOptions): Extension[] {
  // Convert schema to SQLNamespace format
  const schema = convertToSQLNamespace(currentSchemas);

  return [
    createDuckDbSql(schema),
    createCompletion({
      language: SqlRoomsDuckDBDialect.language,
      currentSchemas,
      getFunctionSuggestions: connector
        ? (query: string) => getFunctionSuggestions(connector, query)
        : undefined,
    }),
    createDuckDbSqlExtension(schema, currentSchemas),
    createHover({
      getFunctionDocumentation: connector
        ? (functionName: string) =>
            getFunctionDocumentation(connector, functionName)
        : undefined,
    }),
  ];
}
