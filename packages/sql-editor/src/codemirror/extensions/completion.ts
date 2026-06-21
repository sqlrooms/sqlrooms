import {
  type CompletionContext as CMCompletionContext,
  type Completion,
  type CompletionInfo,
  type CompletionSource,
  autocompletion,
  ifNotIn,
  insertCompletionText,
} from '@codemirror/autocomplete';
import type {LRLanguage} from '@codemirror/language';
import type {Extension} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import {FunctionDocumentation} from '../../components/FunctionDocumentation';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import type {GroupedFunctionSuggestion} from '@sqlrooms/db';
import {escapeId, type DataTable} from '@sqlrooms/duckdb';

const FUNCTION_INFO_DELAY_MS = 750;
const ACTIVATE_ON_TYPING_DELAY_MS = 500;

export interface CompletionContext {
  language: LRLanguage;
  currentSchemas: DataTable[];
  getFunctionSuggestions?: (
    query: string,
  ) => Promise<GroupedFunctionSuggestion[]>;
}

function createColumnCompletion(column: {
  name: string;
  type: string;
  tableName: string;
}): Completion {
  const applyIdentifier = (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number,
  ) => {
    const escaped = escapeId(column.name);
    const previousCharacter =
      from > 0 ? view.state.sliceDoc(from - 1, from) : '';
    const replaceFrom =
      escaped.startsWith('"') &&
      (previousCharacter === '"' || previousCharacter === "'")
        ? from - 1
        : from;

    view.dispatch(insertCompletionText(view.state, escaped, replaceFrom, to));
  };

  return {
    label: column.name,
    type: 'property',
    detail: `${column.tableName} - ${column.type}`,
    apply: applyIdentifier,
    boost: 5,
  };
}

function createColumnCompletionSource(tables: DataTable[]): CompletionSource {
  const options = tables.flatMap((table): Completion[] => {
    const tableName = table.table.table;

    return table.columns.map((column) =>
      createColumnCompletion({
        name: column.name,
        type: column.type,
        tableName,
      }),
    );
  });

  return (completionContext: CMCompletionContext) => {
    if (options.length === 0) {
      return null;
    }

    const word = completionContext.matchBefore(/[\w-]*/);
    if (!word || word.from === word.to) {
      return null;
    }

    const textBeforeCursor = completionContext.state.sliceDoc(
      Math.max(0, completionContext.pos - 200),
      completionContext.pos,
    );
    const previousCharacter =
      word.from > 0
        ? completionContext.state.sliceDoc(word.from - 1, word.from)
        : '';
    const isSingleQuotedPrefix = previousCharacter === "'";

    if (
      (isSingleQuotedPrefix && !word.text.includes('-')) ||
      /\.[\w-]*$/.test(textBeforeCursor) ||
      /\b(from|join|into|update|table|describe|desc|attach)\s+(?:"[^"]*"?|[\w-]*)$/i.test(
        textBeforeCursor,
      )
    ) {
      return null;
    }

    return {
      from: word.from,
      options,
      validFor: /^[\w-]*$/,
    };
  };
}

function delayedFunctionInfo(
  functions: GroupedFunctionSuggestion['overloads'],
): Promise<CompletionInfo> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve(
        renderComponentToDomElement(FunctionDocumentation, {
          functions,
        }),
      );
    }, FUNCTION_INFO_DELAY_MS);
  });
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
              info: () => delayedFunctionInfo(overloads),
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
        ['LineComment', 'BlockComment'],
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
      activateOnTypingDelay: ACTIVATE_ON_TYPING_DELAY_MS,
    }),
  ];
}
