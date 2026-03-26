import {
  type CompletionContext as CMCompletionContext,
  type Completion,
  autocompletion,
} from '@codemirror/autocomplete';
import type {Extension} from '@codemirror/state';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import type {GroupedFunctionSuggestion} from '@sqlrooms/db';

export interface CompletionContext {
  getKeywordSuggestions?: () => string[];
  getFunctionSuggestions?: (
    query: string,
  ) => Promise<GroupedFunctionSuggestion[]>;
}

/**
 * Creates SQL completion extension with dynamic function docs and keywords.
 * Complements marimo-sql's base SQL completions (keywords, tables, columns, CTEs).
 */
export function createCompletion({
  getKeywordSuggestions,
  getFunctionSuggestions,
}: CompletionContext): Extension {
  const completionSource = async (completionContext: CMCompletionContext) => {
    const suggestions: Completion[] = [];

    // Get word at cursor for matching
    const word = completionContext.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !completionContext.explicit)) {
      return null;
    }

    // Add keywords
    const keywords = getKeywordSuggestions?.() ?? [];
    keywords.forEach((keyword) => {
      suggestions.push({
        label: keyword,
        type: 'keyword',
        boost: 5,
      });
    });

    // Add dynamic function suggestions with documentation
    if (getFunctionSuggestions && word.text) {
      try {
        const functionGroups = await getFunctionSuggestions(word.text);

        suggestions.push(
          ...functionGroups.map(({name, overloads}): Completion => {
            return {
              label: name,
              type: 'method',
              detail: overloads[0]?.description ?? '',
              info: () =>
                renderComponentToDomElement(FunctionDocumentation, {
                  functions: overloads,
                }),
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
    // Don't auto-select the first item when completion list opens
    // This prevents the info tooltip from showing immediately
    selectOnOpen: false,
  });
}
