import {ErrorObject, ValidateFunction} from 'ajv';
import {parseTree, Node, findNodeAtLocation} from 'jsonc-parser';
import {Diagnostic} from '@codemirror/lint';

/**
 * Validates JSON text against a JSON schema and returns diagnostics
 * @param text - JSON text to validate
 * @param schema - JSON schema to validate against
 * @returns Array of validation diagnostics
 */
export function validateJsonSchema(
  text: string,
  validate: ValidateFunction,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

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

      // Filter and deduplicate errors
      const filteredErrors = filterMeaningfulErrors(validate.errors);

      for (const error of filteredErrors) {
        const diagnostic = convertErrorToDiagnostic(error, text, tree);
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      diagnostics.push({
        from: 0,
        to: Math.min(text.length, 100),
        severity: 'error',
        message: `Unexpected error during validation`,
      });

      return diagnostics;
    }

    // JSON parse error
    const [, errorMatch] = error.message.match(/position (\d+)/) ?? [];
    const position = errorMatch ? parseInt(errorMatch, 10) : 0;

    diagnostics.push({
      from: Math.min(position, text.length),
      to: Math.min(position + 1, text.length),
      severity: 'error',
      message: `Invalid JSON: ${error.message}`,
    });
  }

  return diagnostics;
}

/**
 * Filters out unhelpful/duplicate errors from anyOf/oneOf branches.
 * Prioritizes specific, actionable errors over generic ones.
 */
function filterMeaningfulErrors(errors: ErrorObject[]): ErrorObject[] {
  // Group errors by path
  const errorsByPath = new Map<string, ErrorObject[]>();

  for (const error of errors) {
    const path = error.instancePath || 'root';
    if (!errorsByPath.has(path)) {
      errorsByPath.set(path, []);
    }
    errorsByPath.get(path)!.push(error);
  }

  const meaningful: ErrorObject[] = [];

  for (const [, pathErrors] of errorsByPath) {
    // Filter out generic anyOf/oneOf errors if we have more specific errors
    const specificErrors = pathErrors.filter(
      (e) => e.keyword !== 'anyOf' && e.keyword !== 'oneOf',
    );

    if (specificErrors.length > 0) {
      // For required properties, include all of them
      const requiredErrors = specificErrors.filter(
        (e) => e.keyword === 'required',
      );
      if (requiredErrors.length > 0) {
        meaningful.push(...requiredErrors); // Include all required errors
        continue;
      }

      // Prioritize enum errors (they're most specific)
      const enumErrors = specificErrors.filter((e) => e.keyword === 'enum');
      if (enumErrors.length > 0 && enumErrors[0]) {
        meaningful.push(enumErrors[0]); // Take first enum error
        continue;
      }

      // Prioritize type errors
      const typeErrors = specificErrors.filter((e) => e.keyword === 'type');
      if (typeErrors.length > 0 && typeErrors[0]) {
        meaningful.push(typeErrors[0]); // Take first type error
        continue;
      }

      // Take first specific error
      if (specificErrors[0]) {
        meaningful.push(specificErrors[0]);
      }
    } else if (pathErrors.length > 0 && pathErrors[0]) {
      // Only anyOf/oneOf errors - take one
      meaningful.push(pathErrors[0]);
    }
  }

  return meaningful;
}

/**
 * Converts an ajv validation error to a validation diagnostic
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
    .filter((segment) => segment !== '')
    .map((segment) => {
      // Convert numeric strings to numbers for array indices
      const num = parseInt(segment, 10);
      return isNaN(num) ? segment : num;
    });

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
  switch (error.keyword) {
    case 'type':
      return `Should be ${error.params.type}`;
    case 'required':
      return `Missing required property '${error.params.missingProperty}'`;
    case 'enum': {
      const values = error.params.allowedValues;
      // Show first 5 values, indicate if there are more
      const displayValues =
        values.length > 5
          ? values.slice(0, 5).join(', ') + `, ... (${values.length - 5} more)`
          : values.join(', ');
      return `Should be one of: ${displayValues}`;
    }
    case 'minimum':
      return `Should be >= ${error.params.limit}`;
    case 'maximum':
      return `Should be <= ${error.params.limit}`;
    case 'minLength':
      return `Should be at least ${error.params.limit} characters`;
    case 'maxLength':
      return `Should be at most ${error.params.limit} characters`;
    case 'pattern':
      return `Should match pattern: ${error.params.pattern}`;
    case 'additionalProperties':
      return `Unknown property '${error.params.additionalProperty}'`;
    case 'anyOf':
    case 'oneOf':
      return 'Does not match any valid schema variant';
    default:
      return error.message || 'Validation error';
  }
}
