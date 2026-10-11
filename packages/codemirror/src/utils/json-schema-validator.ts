import {LanguageService} from 'vscode-json-languageservice';

/**
 * Validator object containing schema and language service
 */
export interface JsonSchemaValidator {
  schema: object;
  languageService: LanguageService;
}
