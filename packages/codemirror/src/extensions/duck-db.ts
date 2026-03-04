import type {Extension} from '@codemirror/state';
import {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {createDuckDbSql} from './duckdb-sql';
import {convertToSQLNamespace} from '../utils/schema-converter';
import {createDuckDbCompletion} from './duckdb-completion';
import {createDuckDbSqlExtension} from './duckdb-sql-extension';

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

  const languageSupport = createDuckDbSql(schema);

  return [
    languageSupport,
    createDuckDbCompletion({
      languageSupport,
      connector,
      customKeywords,
      customFunctions,
    }),
    createDuckDbSqlExtension(schema),
  ];
}
