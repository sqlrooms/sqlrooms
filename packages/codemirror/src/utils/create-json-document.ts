import {JSONDocument} from 'vscode-json-languageservice';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {JsonSchemaValidator} from './validate-json-schema';

type CreateJsonDocumentReturn = {
  document: TextDocument;
  jsonDocument: JSONDocument;
};

/**
 * Creates a TextDocument and parses it as JSON
 * @param text JSON text content
 * @param validator JSON schema validator
 * @returns TextDocument and parsed JSONDocument
 */
export function createJsonDocument(
  text: string,
  validator: JsonSchemaValidator,
): CreateJsonDocumentReturn {
  const document = TextDocument.create('inmemory://doc.json', 'json', 1, text);
  const jsonDocument = validator.languageService.parseJSONDocument(document);
  return {document, jsonDocument};
}
