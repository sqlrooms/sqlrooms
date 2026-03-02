import {
  autocompletion,
  type CompletionContext,
  type Completion,
} from '@codemirror/autocomplete';
import type {Extension} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import {getFunctionSuggestions, type DuckDbConnector} from '@sqlrooms/duckdb';

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
  return autocompletion({
    override: [
      async (completionContext: CompletionContext) => {
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

        // Add custom keywords
        ctx.customKeywords.forEach((keyword) => {
          suggestions.push({
            label: keyword,
            type: 'keyword',
            detail: 'Custom Keyword',
            boost: 5,
          });
        });

        // Add custom functions
        ctx.customFunctions.forEach((func) => {
          suggestions.push({
            label: func,
            type: 'function',
            detail: 'Custom Function',
            boost: 0,
          });
        });

        // Add dynamic function suggestions with documentation from DuckDB
        if (ctx.connector && word.text) {
          try {
            const functionSuggestions = await getFunctionSuggestions(
              ctx.connector,
              word.text,
            );

            suggestions.push(
              ...Array.from(functionSuggestions).map(
                ({name, documentation}) => ({
                  label: name,
                  type: 'function',
                  detail: 'DuckDB Function',
                  info: documentation, // HTML formatted documentation
                  boost: 5, // Higher boost for DuckDB functions
                }),
              ),
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
      },
    ],
  });
}

/** Updates completion context when props change */
export function updateDuckDbCompletionContext(
  view: EditorView,
  context: DuckDbCompletionContext,
): void {
  duckdbCompletionContextByView.set(view, context);
}

/** Cleans up completion context on unmount */
export function cleanupDuckDbCompletionContext(view: EditorView): void {
  duckdbCompletionContextByView.delete(view);
}
