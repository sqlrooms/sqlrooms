import {
  type CompletionContext,
  type Completion,
  autocompletion,
} from '@codemirror/autocomplete';
import type {Extension} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import {type DuckDbConnector, getFunctionSuggestions} from '@sqlrooms/duckdb';
import {DUCKDB_SQL_KEYWORDS} from './duckdb-keywords';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToString} from '@sqlrooms/utils';

interface DuckDbCompletionContext {
  connector?: DuckDbConnector;
  customKeywords: string[];
  customFunctions: string[];
}

const duckdbCompletionContextByView = new WeakMap<
  EditorView,
  DuckDbCompletionContext
>();

/**
 * Creates DuckDB completion extension with dynamic function docs and custom keywords/functions.
 * Complements marimo-sql's base SQL completions (keywords, tables, columns, CTEs).
 */
export function createDuckDbCompletion(
  context: DuckDbCompletionContext,
): Extension {
  const completionSource = async (completionContext: CompletionContext) => {
    // Get context from WeakMap (falls back to initial context)
    const view = completionContext.view;
    const ctx = view
      ? (duckdbCompletionContextByView.get(view) ?? context)
      : context;

    const suggestions: Completion[] = [];

    // Get word at cursor for matching
    const word = completionContext.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !completionContext.explicit)) {
      return null;
    }

    // Add keywords
    [...DUCKDB_SQL_KEYWORDS, ...ctx.customKeywords].forEach((keyword) => {
      suggestions.push({
        label: keyword,
        type: 'keyword',
        boost: 5,
      });
    });

    // Add custom functions
    ctx.customFunctions.forEach((func) => {
      suggestions.push({
        label: func,
        type: 'method',
        boost: 0,
      });
    });

    // Add dynamic function suggestions with documentation from DuckDB
    if (ctx.connector && word.text) {
      try {
        const functionGroups = await getFunctionSuggestions(
          ctx.connector,
          word.text,
        );

        suggestions.push(
          ...functionGroups.map(({name, overloads}): Completion => {
            const dom = document.createElement('div');
            dom.innerHTML = renderComponentToString(FunctionDocumentation, {
              functions: overloads,
            });

            return {
              label: name,
              type: 'method',
              detail: overloads[0]?.description ?? '',
              info: () => dom,
              boost: 5,
            };
          }),
        );
      } catch (error) {
        console.error('Error fetching DuckDB function suggestions:', error);
      }
    }

    return suggestions.length > 0
      ? {
          from: word.from,
          options: suggestions,
        }
      : null;
  };

  // Override default SQL completions with our custom completion source
  return autocompletion({
    override: [completionSource],
  });
}
