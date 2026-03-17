import {linter} from '@codemirror/lint';
import {validateJsonSchema} from '../utils/validate-json-schema';
import {Extension} from '@codemirror/state';
import {createJsonSchemaValidator} from '../utils/create-json-schema-validator';

/**
 * Creates a linter extension for JSON schema validation
 * @param schema JSON schema to validate against
 * @param delay Debounce delay in milliseconds (default: 500ms)
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(
  schema: object,
  delay: number = 500,
): Extension {
  try {
    const validator = createJsonSchemaValidator(schema);

    return linter(
      async (view) => {
        const text = view.state.doc.toString();
        const diagnostics = await validateJsonSchema(text, validator);
        return diagnostics;
      },
      {
        delay, // Debounce validation to avoid slowdown during typing
      },
    );
  } catch (error) {
    console.error('Failed to create JSON schema validator:', error);
    return [];
  }
}
