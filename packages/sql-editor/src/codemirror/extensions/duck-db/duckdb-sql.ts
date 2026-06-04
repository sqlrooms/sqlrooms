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

const STARTER_KEYWORD_SORT_TEXT = new Map(
  [
    'SELECT',
    'FROM',
    'WITH',
    'CREATE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'COPY',
    'DESCRIBE',
    'SHOW',
    'EXPLAIN',
    'SUMMARIZE',
    'ATTACH',
    'INSTALL',
    'LOAD',
  ].map((keyword, index) => [keyword, String(index).padStart(2, '0')]),
);

/** Creates SQL language extension with DuckDB dialect and keyword completion */
export function createDuckDbSql(schema: SQLNamespace): LanguageSupport {
  return sql({
    dialect: SqlRoomsDuckDBDialect,
    schema,
    upperCaseKeywords: true,
    keywordCompletion: (label, type) => {
      const starterSortText = STARTER_KEYWORD_SORT_TEXT.get(label);

      return {
        label,
        type,
        boost: starterSortText ? 50 : 0,
        sortText: starterSortText ?? label,
      };
    },
  });
}
