import {DiagnosticSeverity, LanguageService} from 'vscode-json-languageservice';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {Diagnostic} from '@codemirror/lint';
import {renderComponentToDomElement} from '@sqlrooms/utils';
import {DiagnosticTooltip} from '../components/DiagnosticTooltip';

/**
 * Validator object containing schema and language service
 */
export interface JsonSchemaValidator {
  schema: object;
  languageService: LanguageService;
}

/**
 * Validates JSON text against a JSON schema using vscode-json-languageservice
 * @param text - JSON text to validate
 * @param validator - Validator object containing schema and language service
 * @returns Array of validation diagnostics
 */
export async function validateJsonSchema(
  text: string,
  validator: JsonSchemaValidator,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  // Don't lint empty documents
  if (!text.trim()) {
    return diagnostics;
  }

  try {
    const document = TextDocument.create(
      'inmemory://doc.json',
      'json',
      1,
      text,
    );

    const jsonDocument = validator.languageService.parseJSONDocument(document);

    const vsDiagnostics = await validator.languageService.doValidation(
      document,
      jsonDocument,
    );

    // Convert vscode diagnostics to CodeMirror diagnostics
    for (const {message, code, range, severity: vsSeverity} of vsDiagnostics) {
      diagnostics.push({
        from: document.offsetAt(range.start),
        to: document.offsetAt(range.end),
        severity: convertSeverity(vsSeverity),
        message: message,
        renderMessage: () => {
          const {dom} = renderComponentToDomElement(DiagnosticTooltip, {
            message,
            code,
          });

          return dom;
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `Validation error: ${error.message}`
        : 'Unexpected validation error';

    diagnostics.push({
      from: 0,
      to: Math.min(text.length, 100),
      severity: 'error',
      message,
      renderMessage: () => {
        const {dom} = renderComponentToDomElement(DiagnosticTooltip, {
          message,
        });
        return dom;
      },
    });
  }

  return diagnostics;
}

/**
 * Converts VS Code DiagnosticSeverity to CodeMirror severity
 * VS Code: Error=1, Warning=2, Information=3, Hint=4
 * CodeMirror: 'error' | 'warning' | 'info' | 'hint'
 */
function convertSeverity(
  vsSeverity: DiagnosticSeverity | undefined,
): Diagnostic['severity'] {
  switch (vsSeverity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'warning';
  }
}
