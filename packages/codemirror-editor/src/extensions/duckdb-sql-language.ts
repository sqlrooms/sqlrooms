import {sql} from '@codemirror/lang-sql';
import {DuckDBDialect} from '@marimo-team/codemirror-sql/dialects';
import {DefaultSqlTooltipRenders} from '@marimo-team/codemirror-sql';
import type {SQLNamespace} from '@codemirror/lang-sql';
import type {Extension} from '@codemirror/state';
import {getKeywordDocs} from '../utils/keyword-docs';

/** Creates SQL language extension with DuckDB dialect and keyword completion */
export function createDuckDbSqlLanguage(schema: SQLNamespace): Extension {
  return sql({
    dialect: DuckDBDialect,
    schema,
    upperCaseKeywords: true,
    keywordCompletion: (label) => {
      return {
        label,
        keyword: label,
        info: async () => {
          const dom = document.createElement('div');
          const keywordDocs = await getKeywordDocs();
          const description = keywordDocs[label.toLocaleLowerCase()];
          if (!description) {
            return null;
          }
          dom.innerHTML = DefaultSqlTooltipRenders.keyword({
            keyword: label,
            info: description,
          });
          return dom;
        },
      };
    },
  });
}
