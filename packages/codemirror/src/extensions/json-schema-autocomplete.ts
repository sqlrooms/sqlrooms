import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';
import {Extension} from '@codemirror/state';
import {getJsonSchemaCompletions} from '../utils/get-json-schema-completions';
import {JsonSchemaValidator} from '../utils/json-schema-validator';

/**
 * Creates an autocomplete extension for JSON schema-based completions using vscode-json-languageservice
 * @param validator JSON schema validator instance
 * @returns CodeMirror autocomplete extension
 */
export function jsonSchemaAutocomplete(
  validator: JsonSchemaValidator,
): Extension {
  return autocompletion({
    activateOnTyping: true,
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const text = context.state.doc.toString();
        const word = context.matchBefore(/[\w$"]*$/);

        return getJsonSchemaCompletions(
          text,
          context.pos,
          word?.from,
          validator,
        );
      },
    ],
  });
}
