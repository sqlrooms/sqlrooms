import {sql, SQLDialect} from '@codemirror/lang-sql';
import {DuckDBDialect} from '@marimo-team/codemirror-sql/dialects';
import type {SQLNamespace} from '@codemirror/lang-sql';
import {LanguageSupport} from '@codemirror/language';
import {DUCKDB_SQL_KEYWORDS} from './duckdb-keywords';

export const SqlRoomsDuckDBDialect = SQLDialect.define({
  ...DuckDBDialect.spec,
  keywords: DUCKDB_SQL_KEYWORDS.map((keyword) => keyword.toLowerCase()).join(
    ' ',
  ),
});

/** Creates SQL language extension with DuckDB dialect and keyword completion */
export function createDuckDbSql(schema: SQLNamespace): LanguageSupport {
  return sql({
    dialect: SqlRoomsDuckDBDialect,
    schema,
    upperCaseKeywords: true,
    keywordCompletion: (label, type) => ({
      label,
      type,
      boost: 30,
    }),
  });
}
