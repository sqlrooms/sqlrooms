import {sql} from '@codemirror/lang-sql';
import {DuckDBDialect} from '@marimo-team/codemirror-sql/dialects';
import type {SQLNamespace} from '@codemirror/lang-sql';
import {LanguageSupport} from '@codemirror/language';

/** Creates SQL language extension with DuckDB dialect and keyword completion */
export function createDuckDbSql(schema: SQLNamespace): LanguageSupport {
  return sql({
    dialect: DuckDBDialect,
    schema,
    upperCaseKeywords: true,
  });
}
