import {TextDocument, LanguageService} from 'vscode-json-languageservice';
import {Diagnostic} from '@codemirror/lint';

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
    // Create a TextDocument from the text
    const document = TextDocument.create(
      'inmemory://doc.json',
      'json',
      1,
      text,
    );

    // Parse the JSON document
    const jsonDocument = validator.languageService.parseJSONDocument(document);

    // Get validation diagnostics
    const vsDiagnostics = await validator.languageService.doValidation(
      document,
      jsonDocument,
    );

    // Convert vscode diagnostics to CodeMirror diagnostics
    // VS Code DiagnosticSeverity: Error=1, Warning=2, Information=3, Hint=4
    for (const vsDiagnostic of vsDiagnostics) {
      diagnostics.push({
        from: document.offsetAt(vsDiagnostic.range.start),
        to: document.offsetAt(vsDiagnostic.range.end),
        severity:
          vsDiagnostic.severity === 1 || vsDiagnostic.severity === 2
            ? 'error'
            : 'warning',
        message: vsDiagnostic.message,
      });
    }
  } catch (error) {
    // Handle unexpected errors
    diagnostics.push({
      from: 0,
      to: Math.min(text.length, 100),
      severity: 'error',
      message:
        error instanceof Error
          ? `Validation error: ${error.message}`
          : 'Unexpected validation error',
    });
  }

  return diagnostics;
}
