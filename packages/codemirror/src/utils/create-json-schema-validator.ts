import {getLanguageService} from 'vscode-json-languageservice';
import {JsonSchemaValidator} from './validate-json-schema';

/**
 * Creates a JSON schema validator using vscode-json-languageservice
 * @param schema - JSON schema to validate against
 * @returns Validator object with language service and schema
 */
export function createJsonSchemaValidator(schema: object): JsonSchemaValidator {
  const languageService = getLanguageService({});

  // Register the schema with the language service
  const schemaUri = 'inmemory://schema.json';
  languageService.configure({
    schemas: [
      {
        uri: schemaUri,
        fileMatch: ['*'], // Match all documents
        schema: schema,
      },
    ],
    validate: true,
    allowComments: false,
  });

  return {
    schema,
    languageService,
  };
}
