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
      const filteredErrors = filterMeaningfulErrors(validate.errors, json);

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
 * Extracts the branch index from a schemaPath (e.g., /oneOf/2/required -> 2)
 */
function extractBranchIndex(schemaPath: string): number | null {
  const match = schemaPath.match(/\/(oneOf|anyOf)\/(\d+)/);
  return match && match[2] ? parseInt(match[2], 10) : null;
}

/**
 * Filters out unhelpful/duplicate errors from anyOf/oneOf branches.
 * Prioritizes specific, actionable errors over generic ones.
 */
function filterMeaningfulErrors(
  errors: ErrorObject[],
  data: unknown,
): ErrorObject[] {
  // Check if we have a oneOf/anyOf situation
  const hasOneOf = errors.some(
    (e) => e.keyword === 'oneOf' || e.keyword === 'anyOf',
  );

  if (hasOneOf) {
    // Group errors by branch
    const errorsByBranch = new Map<number, ErrorObject[]>();
    const unbranched: ErrorObject[] = [];

    for (const error of errors) {
      // Skip generic oneOf/anyOf errors
      if (error.keyword === 'oneOf' || error.keyword === 'anyOf') {
        continue;
      }

      const branchIndex = extractBranchIndex(error.schemaPath);
      if (branchIndex !== null) {
        if (!errorsByBranch.has(branchIndex)) {
          errorsByBranch.set(branchIndex, []);
        }
        errorsByBranch.get(branchIndex)!.push(error);
      } else {
        unbranched.push(error);
      }
    }

    // Score each branch to find the most relevant one
    let bestBranch: number | null = null;
    let bestScore = -Infinity;

    for (const [branchIndex, branchErrors] of errorsByBranch) {
      let score = 0;

      // Categorize errors by type
      const enumErrors = branchErrors.filter((e) => e.keyword === 'enum');
      const constErrors = branchErrors.filter((e) => e.keyword === 'const');
      const typeErrors = branchErrors.filter((e) => e.keyword === 'type');
      const patternErrors = branchErrors.filter((e) => e.keyword === 'pattern');
      const additionalPropsErrors = branchErrors.filter(
        (e) => e.keyword === 'additionalProperties',
      );
      const requiredErrors = branchErrors.filter(
        (e) => e.keyword === 'required',
      );

      // Critical insight: "additionalProperties" errors on existing properties
      // indicate WRONG branch (e.g., "Unknown property 'mark'" in a composition branch)
      if (additionalPropsErrors.length > 0) {
        // This branch rejects properties that actually exist in the data
        // This is a strong signal that this is the WRONG branch
        score -= 500 * additionalPropsErrors.length;
      }

      // Strategy: Prefer branches with actionable errors
      // Enum errors are most specific and informative - strongly prefer showing them
      if (enumErrors.length > 0) {
        score += 150;
      }

      // Type and pattern errors are also informative
      if (typeErrors.length > 0) {
        score += 80;
      }
      if (patternErrors.length > 0) {
        score += 80;
      }

      // Const errors need special handling - they often indicate discriminators
      // If const error is on a property that exists but doesn't match, this is WRONG branch
      if (constErrors.length > 0 && data && typeof data === 'object') {
        for (const error of constErrors) {
          const propPath = error.instancePath
            .split('/')
            .filter((s) => s !== '');
          const propName =
            propPath.length > 0 ? propPath[propPath.length - 1] : null;

          if (propName) {
            const dataObj = data as Record<string, unknown>;
            const dataValue = dataObj[propName];
            if (dataValue !== undefined) {
              // Property exists but doesn't match const - this is the WRONG branch
              score -= 300;
            }
          }
        }
      }

      // Score based on data match for required errors
      if (data && typeof data === 'object' && requiredErrors.length > 0) {
        const existingProps = new Set(
          Object.keys(data as Record<string, unknown>),
        );

        // Composition properties (Vega-Lite specific, but generalizable)
        const compositionProps = [
          'facet',
          'layer',
          'repeat',
          'concat',
          'hconcat',
          'vconcat',
        ];

        // Unit properties (Vega-Lite specific)
        const unitProps = ['mark', 'encoding'];

        const hasUnitProps = Array.from(existingProps).some((prop) =>
          unitProps.includes(prop),
        );
        const hasCompositionProps = Array.from(existingProps).some((prop) =>
          compositionProps.includes(prop),
        );

        // Check what properties this branch is asking for
        const asksForComposition = requiredErrors.some((e) =>
          compositionProps.includes(e.params.missingProperty),
        );
        const asksForUnit = requiredErrors.some((e) =>
          unitProps.includes(e.params.missingProperty),
        );

        // Match data to branch type
        if (hasUnitProps && asksForUnit) {
          score += 50; // Data matches unit branch
        } else if (hasCompositionProps && asksForComposition) {
          score += 50; // Data matches composition branch
        } else if (hasUnitProps && asksForComposition) {
          score -= 100; // Data is unit but branch wants composition
        } else if (hasCompositionProps && asksForUnit) {
          score -= 100; // Data is composition but branch wants unit
        } else if (existingProps.size > 0) {
          score += 10; // Has some properties
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestBranch = branchIndex;
      }
    }

    // Filter unbranched errors intelligently
    const filteredUnbranched = unbranched.filter((error) => {
      // Keep enum errors (most actionable and specific)
      if (error.keyword === 'enum') return true;

      // Keep pattern errors
      if (error.keyword === 'pattern') return true;

      // For type errors, be selective
      if (error.keyword === 'type') {
        // Only keep type errors if they're at the root level AND we have no enum errors
        // (enum errors are more specific than type errors)
        const hasEnumError = unbranched.some(
          (e) => e.keyword === 'enum' && e.instancePath === error.instancePath,
        );
        if (hasEnumError) return false; // Skip type error if enum error exists for same path

        // Keep type errors at root level only
        return error.instancePath === '' || error.instancePath === '/';
      }

      // Filter out "Unknown property" errors that are likely from wrong branches
      if (error.keyword === 'additionalProperties') {
        // Only keep if we have NO branch errors (meaning we couldn't determine branch)
        return errorsByBranch.size === 0;
      }

      // Filter out "required" errors that are likely from wrong branches
      if (error.keyword === 'required') {
        // Only keep if we have NO branch errors
        return errorsByBranch.size === 0;
      }

      // Filter out const errors (these are usually discriminators indicating wrong branch)
      if (error.keyword === 'const') return false;

      // Keep other errors by default
      return true;
    });

    // Return errors only from the best branch
    if (bestBranch !== null) {
      const branchErrors = errorsByBranch.get(bestBranch) || [];

      // If best branch has negative score, it means no branch is a good match
      // In this case, show only the filtered unbranched errors (which are more actionable)
      if (bestScore < 0) {
        return filteredUnbranched;
      }

      return [...branchErrors, ...filteredUnbranched];
    }

    // Fallback: return filtered unbranched errors
    return filteredUnbranched;
  }

  // Original logic for non-oneOf cases
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
      // Prioritize enum errors (they're most specific)
      const enumErrors = specificErrors.filter((e) => e.keyword === 'enum');
      if (enumErrors.length > 0 && enumErrors[0]) {
        meaningful.push(enumErrors[0]); // Take first enum error
        continue;
      }

      // For required properties, include all of them
      const requiredErrors = specificErrors.filter(
        (e) => e.keyword === 'required',
      );
      if (requiredErrors.length > 0) {
        meaningful.push(...requiredErrors);
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
