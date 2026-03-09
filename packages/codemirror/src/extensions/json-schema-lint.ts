import {linter} from '@codemirror/lint';
import {validateJsonSchema} from '../utils/validate-json-schema';
import {Extension} from '@codemirror/state';
import {createJsonSchemaValidator} from '../utils/create-json-schema-validator';

/**
 * Creates a linter extension for JSON schema validation
 * @param schema JSON schema to validate against
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(schema: object): Extension {
  try {
    const validator = createJsonSchemaValidator(schema);

    return linter((view) => {
      const text = view.state.doc.toString();
      return validateJsonSchema(text, validator);
    });
  } catch (error) {
    console.error('Failed to create JSON schema validator:', error);
    return [];
  }
}
