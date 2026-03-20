import {CompletionResult, Completion, snippet} from '@codemirror/autocomplete';
import {
  CompletionItemKind,
  InsertTextFormat,
  CompletionItem,
} from 'vscode-languageserver-types';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {EditorView} from '@codemirror/view';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import {JsonSchemaDocumentation} from '../components/JsonSchemaDocumentation';
import {createJsonDocument} from './create-json-document';
import {JsonSchemaValidator} from './json-schema-validator';

/**
 * Converts LSP snippet syntax to CodeMirror snippet syntax
 * LSP: $1, $2, ${1:default} → CodeMirror: ${}, ${default}
 */
function convertLspSnippetToCodeMirror(text: string): string {
  return text
    .replace(/\$\{(\d+):([^}]*)\}/g, '${$2}') // ${1:text} → ${text}
    .replace(/\$\d+/g, '${}'); // $1, $2, etc → ${}
}

/**
 * Strips LSP snippet syntax from plain text
 */
function stripSnippetSyntax(text: string): string {
  return text
    .replace(/\$\{\d+:?([^}]*)\}/g, '$1') // ${1:text} → text
    .replace(/\$\d+/g, ''); // $1 → empty
}

/**
 * Creates the apply value for a completion item, handling textEdit ranges and snippet formats
 */
function createCompletionApply(
  item: CompletionItem,
  document: TextDocument,
):
  | string
  | ((
      view: EditorView,
      completion: Completion,
      from: number,
      to: number,
    ) => void) {
  // Determine insertion text from textEdit, insertText, or label
  let insertText =
    item.textEdit && 'newText' in item.textEdit
      ? item.textEdit.newText
      : item.insertText || item.label;

  // Convert or strip snippet syntax based on format
  if (item.insertTextFormat === InsertTextFormat.Snippet) {
    insertText = convertLspSnippetToCodeMirror(insertText);
  } else if (insertText.includes('$')) {
    // Language service sometimes includes snippet syntax without setting the format
    insertText = stripSnippetSyntax(insertText);
  }

  // Check if the text actually contains snippet placeholders after conversion
  const hasPlaceholders =
    insertText.includes('${}') || insertText.includes('${');

  // Handle per-item textEdit range
  if (item.textEdit && 'range' in item.textEdit) {
    const editFrom = document.offsetAt(item.textEdit.range.start);
    const editTo = document.offsetAt(item.textEdit.range.end);

    // Only use snippet API if there are actual placeholders
    if (item.insertTextFormat === InsertTextFormat.Snippet && hasPlaceholders) {
      // Apply snippet with custom range
      return (view, completion) => {
        snippet(insertText)(view, completion, editFrom, editTo);
      };
    } else {
      // Apply plain text with custom range (even if originally marked as snippet)
      return (view) => {
        view.dispatch({
          changes: {from: editFrom, to: editTo, insert: insertText},
          selection: {anchor: editFrom + insertText.length},
        });
      };
    }
  }

  // No custom range - use default behavior
  if (item.insertTextFormat === InsertTextFormat.Snippet && hasPlaceholders) {
    return snippet(insertText);
  }

  return insertText;
}

/**
 * Gets JSON schema completions for a given position in the text
 * @param text JSON text content
 * @param pos Cursor position in the text
 * @param wordFrom Start position of the current word being completed (or null)
 * @param validator JSON schema validator instance
 * @returns Completion result or null if no completions available
 */
export async function getJsonSchemaCompletions(
  text: string,
  pos: number,
  wordFrom: number | undefined,
  validator: JsonSchemaValidator,
): Promise<CompletionResult | null> {
  // Create and parse JSON document
  const {document, jsonDocument} = createJsonDocument(text, validator);

  // Get position for completion
  const position = document.positionAt(pos);

  // Get completions from vscode-json-languageservice
  const completionList = await validator.languageService.doComplete(
    document,
    position,
    jsonDocument,
  );

  if (!completionList || completionList.items.length === 0) {
    return null;
  }

  // Track if any completions use position-dependent textEdit ranges
  let hasPositionDependentCompletions = false;

  // Convert vscode-json-languageservice completions to CodeMirror completions
  const options = completionList.items.map<Completion>((item) => {
    // Check if this item uses a position-dependent textEdit range
    if (item.textEdit && 'range' in item.textEdit) {
      hasPositionDependentCompletions = true;
    }

    // Convert documentation to string if it's a MarkupContent object
    const documentation =
      typeof item.documentation === 'string'
        ? item.documentation
        : item.documentation?.value;

    return {
      label: item.label,
      type: convertCompletionItemKind(item.kind),
      detail: item.detail,
      info: documentation
        ? () =>
            renderComponentToDomElement(JsonSchemaDocumentation, {
              documentation,
            })
        : undefined,
      apply: createCompletionApply(item, document),
      boost: item.sortText ? -(parseInt(item.sortText, 10) || 0) : 0,
    };
  });

  return {
    from: wordFrom ?? pos,
    options,
    // Disable caching for position-dependent completions to prevent stale offsets
    validFor: hasPositionDependentCompletions ? undefined : /^[\w$"]*$/,
  };
}

/**
 * Converts vscode-json-languageservice CompletionItemKind to CodeMirror completion type
 */
function convertCompletionItemKind(
  kind: CompletionItemKind | undefined,
): string {
  switch (kind) {
    case CompletionItemKind.Property:
      return 'property';
    case CompletionItemKind.Value:
      return 'constant';
    case CompletionItemKind.Enum:
      return 'enum';
    case CompletionItemKind.Keyword:
      return 'keyword';
    case CompletionItemKind.Class:
      return 'class';
    case CompletionItemKind.Function:
      return 'function';
    case CompletionItemKind.Variable:
      return 'variable';
    case CompletionItemKind.Text:
      return 'text';
    default:
      return 'property';
  }
}
