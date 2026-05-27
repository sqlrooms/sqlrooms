import {
  type CompletionContext as CMCompletionContext,
  type Completion,
  type CompletionSource,
  autocompletion,
  ifNotIn,
} from '@codemirror/autocomplete';
import type {LRLanguage} from '@codemirror/language';
import type {Extension} from '@codemirror/state';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import type {GroupedFunctionSuggestion} from '@sqlrooms/db';
import type {DataTable} from '@sqlrooms/duckdb';

export interface CompletionContext {
  language: LRLanguage;
  currentSchemas: DataTable[];
  getFunctionSuggestions?: (
    query: string,
  ) => Promise<GroupedFunctionSuggestion[]>;
}

function createColumnCompletionSource(tables: DataTable[]): CompletionSource {
  const options = tables.flatMap((table): Completion[] => {
    const tableName = table.table.table;

    return table.columns.map((column) => ({
      label: column.name,
      type: 'property',
      detail: `${tableName} - ${column.type}`,
      boost: 5,
    }));
  });

  return (completionContext: CMCompletionContext) => {
    if (options.length === 0) {
      return null;
    }

    const word = completionContext.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !completionContext.explicit)) {
      return null;
    }

    const line = completionContext.state.doc.lineAt(completionContext.pos);
    const textBeforeCursor = line.text.slice(
      0,
      completionContext.pos - line.from,
    );

    if (
      /\.\w*$/.test(textBeforeCursor) ||
      /\b(from|join|into|update|table|describe|desc|attach)\s+(?:"[^"]*"?|[\w]*)$/i.test(
        textBeforeCursor,
      )
    ) {
      return null;
    }

    return {
      from: word.from,
      options,
      validFor: /^\w*$/,
    };
  };
}

/**
 * Creates SQL completion extension with dynamic function docs and keywords.
 * Complements marimo-sql's base SQL completions (keywords, tables, columns, CTEs).
 */
export function createCompletion({
  language,
  currentSchemas,
  getFunctionSuggestions,
}: CompletionContext): Extension {
  const completionSource: CompletionSource = async (
    completionContext: CMCompletionContext,
  ) => {
    const suggestions: Completion[] = [];

    // Get word at cursor for matching
    const word = completionContext.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !completionContext.explicit)) {
      return null;
    }

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
              boost: -20,
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
          validFor: /^\w*$/,
        }
      : null;
  };

  return [
    language.data.of({
      autocomplete: ifNotIn(
        ['QuotedIdentifier', 'String', 'LineComment', 'BlockComment'],
        createColumnCompletionSource(currentSchemas),
      ),
    }),
    language.data.of({
      autocomplete: ifNotIn(
        ['QuotedIdentifier', 'String', 'LineComment', 'BlockComment', '.'],
        completionSource,
      ),
    }),
    autocompletion({
      selectOnOpen: true,
      filterStrict: true,
      interactionDelay: 0,
    }),
  ];
}
