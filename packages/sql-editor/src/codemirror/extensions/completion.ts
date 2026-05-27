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

function needsIdentifierQuotes(identifier: string): boolean {
  return !/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
}

function createColumnCompletion(column: {
  name: string;
  type: string;
  tableName: string;
}): Completion {
  const applyQuotedIdentifier = (
    view: EditorView,
    _completion: Completion,
    from: number,
    to: number,
  ) => {
    const replaceFrom =
      from > 0 && view.state.sliceDoc(from - 1, from) === '"' ? from - 1 : from;

    view.dispatch(
      insertCompletionText(view.state, escapeId(column.name), replaceFrom, to),
    );
  };

  return {
    label: column.name,
    type: 'property',
    detail: `${column.tableName} - ${column.type}`,
    apply: needsIdentifierQuotes(column.name) ? applyQuotedIdentifier : undefined,
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

    const line = completionContext.state.doc.lineAt(completionContext.pos);
    const textBeforeCursor = line.text.slice(
      0,
      completionContext.pos - line.from,
    );

    if (
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
        ['String', 'LineComment', 'BlockComment'],
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
