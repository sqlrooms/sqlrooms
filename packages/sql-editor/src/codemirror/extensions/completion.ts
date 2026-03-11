import {
  type CompletionContext as CMCompletionContext,
  type Completion,
  autocompletion,
} from '@codemirror/autocomplete';
import type {Extension} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToString} from '@sqlrooms/utils';
import type {GroupedFunctionSuggestion} from '@sqlrooms/db';

export interface CompletionContext {
  getKeywordSuggestions?: () => string[];
  getFunctionSuggestions?: (
    query: string,
  ) => Promise<GroupedFunctionSuggestion[]>;
}

const completionContextByView = new WeakMap<EditorView, CompletionContext>();

/**
 * Creates SQL completion extension with dynamic function docs and keywords.
 * Complements marimo-sql's base SQL completions (keywords, tables, columns, CTEs).
 */
export function createCompletion(context: CompletionContext): Extension {
  const completionSource = async (completionContext: CMCompletionContext) => {
    // Get context from WeakMap (falls back to initial context)
    const view = completionContext.view;
    const ctx = view ? (completionContextByView.get(view) ?? context) : context;

    const suggestions: Completion[] = [];

    // Get word at cursor for matching
    const word = completionContext.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !completionContext.explicit)) {
      return null;
    }

    // Add keywords
    const keywords = ctx.getKeywordSuggestions?.() ?? [];
    keywords.forEach((keyword) => {
      suggestions.push({
        label: keyword,
        type: 'keyword',
        boost: 5,
      });
    });

    // Add dynamic function suggestions with documentation
    if (ctx.getFunctionSuggestions && word.text) {
      try {
        const functionGroups = await ctx.getFunctionSuggestions(word.text);

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
        console.error('Error fetching function suggestions:', error);
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
