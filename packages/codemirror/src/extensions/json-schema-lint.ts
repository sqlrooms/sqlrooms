import {linter} from '@codemirror/lint';
import {validateJsonSchema} from '../utils/validate-json-schema';
import {Extension} from '@codemirror/state';
import {createJsonSchemaValidator} from '../utils/create-json-schema-validator';

/**
 * Creates a linter extension for JSON schema validation
 * @param schema JSON schema to validate against
 * @param delay Debounce delay in milliseconds (default: 500ms)
 * @param maxErrors Maximum number of errors to show at once (default: 10)
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(
  schema: object,
  delay: number = 500,
  maxErrors: number = 10,
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
        tooltipFilter: (diagnostics) => {
          // Show only the first errors in the tooltip to keep it manageable
          return diagnostics.slice(0, maxErrors);
        },
      },
    );
  } catch (error) {
    console.error('Failed to create JSON schema validator:', error);
    return [];
  }
}
