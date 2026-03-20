import {linter} from '@codemirror/lint';
import {validateJsonSchema} from '../utils/validate-json-schema';
import {Extension} from '@codemirror/state';
import {JsonSchemaValidator} from '../utils/json-schema-validator';

/**
 * Creates a linter extension for JSON schema validation
 * @param validator JSON schema validator instance
 * @param delay Debounce delay in milliseconds (default: 500ms)
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(
  validator: JsonSchemaValidator,
  delay: number = 500,
): Extension {
  return linter(
    async (view) => {
      const text = view.state.doc.toString();
      return await validateJsonSchema(text, validator);
    },
    {
      delay, // Debounce validation to avoid slowdown during typing
    },
  );
}
