import {linter, Diagnostic} from '@codemirror/lint';
import Ajv, {ErrorObject} from 'ajv';
import addFormats from 'ajv-formats';
import {parseTree, Node, findNodeAtLocation} from 'jsonc-parser';

/**
 * Creates a linter extension for JSON schema validation
 * @param schema JSON schema to validate against
 * @returns CodeMirror linter extension
 */
export function jsonSchemaLinter(schema: object) {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    validateSchema: false, // Don't validate the schema itself to avoid meta-schema errors
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();

    // Don't lint empty documents
    if (!text.trim()) {
      return diagnostics;
    }

    try {
      // Parse JSON
      const json = JSON.parse(text);
      const valid = validate(json);

      if (!valid && validate.errors) {
        // Parse with position tracking
        const tree = parseTree(text);

        for (const error of validate.errors) {
          const diagnostic = convertErrorToDiagnostic(error, text, tree);
          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        }
      }
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        diagnostics.push({
          from: 0,
          to: Math.min(text.length, 100),
          severity: 'error',
          message: `Unexpected error during validation`,
        });

        return diagnostics;
      }

      // JSON parse error
      const [errorMatch] = e.message.match(/position (\d+)/) ?? [];
      const position = errorMatch ? parseInt(errorMatch, 10) : 0;

      diagnostics.push({
        from: Math.min(position, text.length),
        to: Math.min(position + 1, text.length),
        severity: 'error',
        message: `Invalid JSON: ${e.message}`,
      });
    }

    return diagnostics;
  });
}

/**
 * Converts an ajv validation error to a CodeMirror diagnostic
 */
function convertErrorToDiagnostic(
  error: ErrorObject,
  text: string,
  tree: Node | undefined,
): Diagnostic | null {
  if (!tree) {
    return null;
  }

  // Parse the instance path (e.g., "/properties/name" or "/items/0")
  const pathSegments = error.instancePath
    .split('/')
    .filter((segment) => segment !== '');

  // Find the node at this path
  let node: Node | undefined = tree;

  if (pathSegments.length > 0) {
    node = findNodeAtLocation(tree, pathSegments);
  }

  if (!node) {
    // If we can't find the specific node, highlight the whole document
    return {
      from: 0,
      to: Math.min(text.length, 100),
      severity: 'error',
      message: formatErrorMessage(error),
    };
  }

  // Get the position range for the error
  const from = node.offset;
  const to = node.offset + node.length;

  return {
    from,
    to,
    severity: 'error',
    message: formatErrorMessage(error),
  };
}

/**
 * Formats an ajv error into a human-readable message
 */
function formatErrorMessage(error: ErrorObject): string {
  const path = error.instancePath || 'root';

  switch (error.keyword) {
    case 'type':
      return `${path}: should be ${error.params.type}`;
    case 'required':
      return `${path}: missing required property '${error.params.missingProperty}'`;
    case 'enum':
      return `${path}: should be one of [${error.params.allowedValues.join(', ')}]`;
    case 'minimum':
      return `${path}: should be >= ${error.params.limit}`;
    case 'maximum':
      return `${path}: should be <= ${error.params.limit}`;
    case 'minLength':
      return `${path}: should be at least ${error.params.limit} characters`;
    case 'maxLength':
      return `${path}: should be at most ${error.params.limit} characters`;
    case 'pattern':
      return `${path}: should match pattern "${error.params.pattern}"`;
    case 'additionalProperties':
      return `${path}: should not have additional property '${error.params.additionalProperty}'`;
    default:
      return error.message || `${path}: validation error`;
  }
}
