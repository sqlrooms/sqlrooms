import {CompletionResult, Completion} from '@codemirror/autocomplete';
import {CompletionItemKind} from 'vscode-languageserver-types';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import {JsonSchemaDocumentation} from '../components/JsonSchemaDocumentation';
import {createJsonDocument} from './create-json-document';
import {JsonSchemaValidator} from './json-schema-validator';

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

  // Convert vscode-json-languageservice completions to CodeMirror completions
  const options = completionList.items.map<Completion>((item) => {
    // Convert documentation to string if it's a MarkupContent object
    const documentation =
      typeof item.documentation === 'string'
        ? item.documentation
        : item.documentation?.value;

    return {
      label: item.label,
      type: convertCompletionItemKind(item.kind),
      detail: item.detail,
      // Render markdown documentation if available
      info: documentation
        ? () =>
            renderComponentToDomElement(JsonSchemaDocumentation, {
              documentation,
            })
        : undefined,
      apply: item.insertText || item.label,
      boost: item.sortText ? -(parseInt(item.sortText, 10) || 0) : 0,
    };
  });

  return {
    from: wordFrom ?? pos,
    options,
    validFor: /^[\w$"]*$/,
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
