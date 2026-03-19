import {getLanguageService} from 'vscode-json-languageservice';
import {JsonSchemaValidator} from './validate-json-schema';

/**
 * Creates a JSON schema validator using vscode-json-languageservice
 * @param schema - JSON schema to validate against
 * @returns Validator object with language service and schema
 */
export function createJsonSchemaValidator(schema: object): JsonSchemaValidator {
  const languageService = getLanguageService({
    schemaRequestService: async (uri: string) => {
      try {
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch schema from ${uri}: ${message}`);
      }
    },
  });

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
