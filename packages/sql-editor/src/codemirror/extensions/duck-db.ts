import type {Extension} from '@codemirror/state';
import {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {createDuckDbSql} from './duckdb-sql';
import {convertToSQLNamespace} from '../utils/schema-converter';
import {createDuckDbCompletion} from './duckdb-completion';
import {createDuckDbSqlExtension} from './duckdb-sql-extension';
import {createDuckDbHover} from './duckdb-hover';

type DuckDbExtensionOptions = {
  currentSchemas: DataTable[];
  connector?: DuckDbConnector;
  customKeywords: string[];
  customFunctions: string[];
};

export function createDuckDbExtension({
  currentSchemas,
  connector,
  customKeywords,
  customFunctions,
}: DuckDbExtensionOptions): Extension[] {
  // Convert schema to SQLNamespace format
  const schema = convertToSQLNamespace(currentSchemas);

  const extensions: Extension[] = [
    createDuckDbSql(schema),
    createDuckDbCompletion({
      connector,
      customKeywords,
      customFunctions,
    }),
    createDuckDbSqlExtension(schema, currentSchemas),
    createDuckDbHover({connector}),
  ];

  return extensions;
}
