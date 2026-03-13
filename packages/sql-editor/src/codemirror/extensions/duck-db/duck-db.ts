import type {Extension} from '@codemirror/state';
import {
  DataTable,
  DuckDbConnector,
  getFunctionSuggestions,
  getFunctionDocumentation,
} from '@sqlrooms/duckdb';
import {createDuckDbSql} from './duckdb-sql';
import {convertToSQLNamespace} from '../../utils/schema-converter';
import {createCompletion} from '../completion';
import {createDuckDbSqlExtension} from './duckdb-sql-extension';
import {createHover} from '../hover';
import {DUCKDB_SQL_KEYWORDS} from './duckdb-keywords';

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
      getKeywordSuggestions: () => DUCKDB_SQL_KEYWORDS,
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
