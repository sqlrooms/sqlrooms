import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from '@codemirror/autocomplete';
import {syntaxTree} from '@codemirror/language';
import {Extension} from '@codemirror/state';
import {SyntaxNode} from '@lezer/common';

/**
 * Creates an autocomplete extension for JSON schema-based completions
 * @param schema JSON schema to extract completions from
 * @returns CodeMirror autocomplete extension
 */
export function jsonSchemaAutocomplete(schema: object): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        const tree = syntaxTree(context.state);
        const node = tree.resolveInner(context.pos, -1);

        // Determine context: are we completing a property key or a value?
        const isPropertyKey = isInPropertyKeyPosition(node, context.pos);

        if (isPropertyKey) {
          // Suggest property names from schema
          const path = getJsonPath(node);
          const completions = extractPropertyCompletions(schema, path);

          if (completions.length > 0) {
            // Find the start of the current word
            const word = context.matchBefore(/[\w$"]*$/);
            return {
              from: word ? word.from : context.pos,
              options: completions,
              validFor: /^[\w$"]*$/,
            };
          }
        } else {
          // Suggest values based on property type/enum
          const path = getJsonPath(node);
          const propertyName = getPropertyName(node);

          if (propertyName) {
            const completions = extractValueCompletions(
              schema,
              path,
              propertyName,
            );

            if (completions.length > 0) {
              const word = context.matchBefore(/[\w$"]*$/);
              return {
                from: word ? word.from : context.pos,
                options: completions,
              };
            }
          }
        }

        return null;
      },
    ],
  });
}

/**
 * Determines if the cursor is in a position to complete a property key
 */
function isInPropertyKeyPosition(node: SyntaxNode, pos: number): boolean {
  // Check if we're inside an object and before a colon
  let current: SyntaxNode | null = node;

  while (current) {
    if (current.name === 'Property') {
      // Inside a property - check if before the colon
      const colonNode = findChildByName(current, ':');
      if (!colonNode || pos <= colonNode.from) {
        return true;
      }
      return false;
    }

    if (current.name === 'Object') {
      // Inside an object, but not yet in a property - completing a new property key
      return true;
    }

    current = current.parent;
  }

  return false;
}

/**
 * Gets the JSON path to the current node
 */
function getJsonPath(node: SyntaxNode): string[] {
  const path: string[] = [];
  let current: SyntaxNode | null = node;

  while (current) {
    if (current.name === 'Property') {
      // Get the property name
      const propertyName = getPropertyName(current);
      if (propertyName) {
        path.unshift(propertyName);
      }
    }

    current = current.parent;
  }

  return path;
}

/**
 * Gets the property name from a Property node
 */
function getPropertyName(node: SyntaxNode): string | null {
  if (node.name !== 'Property' && node.name !== 'PropertyName') {
    // Try to find PropertyName child
    const propertyNameNode = findChildByName(node, 'PropertyName');
    if (propertyNameNode) {
      node = propertyNameNode;
    } else {
      return null;
    }
  }

  const text = node.from !== undefined ? node.toString() : null;
  if (!text) return null;

  // Remove quotes if present
  return text.replace(/^["']|["']$/g, '');
}

/**
 * Finds a child node by name
 */
function findChildByName(
  node: SyntaxNode,
  name: string,
): SyntaxNode | undefined {
  let child = node.firstChild;
  while (child) {
    if (child.name === name) return child;
    child = child.nextSibling;
  }
  return undefined;
}

/**
 * Extracts property name completions from schema at the given path
 */
function extractPropertyCompletions(schema: any, path: string[]): Completion[] {
  const completions: Completion[] = [];

  // Navigate to the schema at this path
  let currentSchema = schema;
  for (const segment of path) {
    if (currentSchema.properties && currentSchema.properties[segment]) {
      currentSchema = currentSchema.properties[segment];
    } else if (currentSchema.items) {
      currentSchema = currentSchema.items;
    } else {
      // Can't navigate further
      break;
    }
  }

  // Extract property completions
  if (currentSchema.properties) {
    for (const [key, propSchema] of Object.entries(currentSchema.properties)) {
      const typed = propSchema as any;
      completions.push({
        label: `"${key}"`,
        type: 'property',
        detail: typed.type || 'any',
        info: typed.description,
        apply: `"${key}": `,
      });
    }
  }

  return completions;
}

/**
 * Extracts value completions from schema based on property type
 */
function extractValueCompletions(
  schema: any,
  path: string[],
  propertyName: string,
): Completion[] {
  const completions: Completion[] = [];

  // Navigate to the schema for this property
  let currentSchema = schema;
  for (const segment of path) {
    if (currentSchema.properties && currentSchema.properties[segment]) {
      currentSchema = currentSchema.properties[segment];
    } else if (currentSchema.items) {
      currentSchema = currentSchema.items;
    } else {
      break;
    }
  }

  // Get the property schema
  let propertySchema: any = null;
  if (currentSchema.properties && currentSchema.properties[propertyName]) {
    propertySchema = currentSchema.properties[propertyName];
  }

  if (!propertySchema) return completions;

  // If enum, return enum values
  if (propertySchema.enum && Array.isArray(propertySchema.enum)) {
    for (const value of propertySchema.enum) {
      completions.push({
        label: JSON.stringify(value),
        type: 'enum',
        detail: propertySchema.type || 'any',
        apply: JSON.stringify(value),
      });
    }
  }
  // If boolean, return true/false
  else if (propertySchema.type === 'boolean') {
    completions.push(
      {
        label: 'true',
        type: 'keyword',
        detail: 'boolean',
        apply: 'true',
      },
      {
        label: 'false',
        type: 'keyword',
        detail: 'boolean',
        apply: 'false',
      },
    );
  }
  // If null
  else if (propertySchema.type === 'null') {
    completions.push({
      label: 'null',
      type: 'keyword',
      detail: 'null',
      apply: 'null',
    });
  }

  return completions;
}
