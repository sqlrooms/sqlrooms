import {linter} from '@codemirror/lint';
import {validateJsonSchema} from '../utils/validate-json-schema';
import {Extension} from '@codemirror/state';

/**
 * Creates a linter extension for JSON schema validation
 * @param schema JSON schema to validate against
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(schema: object): Extension {
  return linter((view) => {
    const text = view.state.doc.toString();
    return validateJsonSchema(text, schema);
  });
}
