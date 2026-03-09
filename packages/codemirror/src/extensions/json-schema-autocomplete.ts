import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from '@codemirror/autocomplete';
import {syntaxTree} from '@codemirror/language';
import {Extension, Text} from '@codemirror/state';
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
        const doc = context.state.doc;

        // Determine context: are we completing a property key or a value?
        const isPropertyKey = isInPropertyKeyPosition(node, context.pos);

        if (isPropertyKey) {
          return completePropertyKey(node, doc, context, schema);
        } else {
          return completePropertyValue(node, doc, context, schema);
        }
      },
    ],
  });
}

/**
 * Completes property keys based on JSON schema
 */
function completePropertyKey(
  node: SyntaxNode,
  doc: Text,
  context: CompletionContext,
  schema: object,
): CompletionResult | null {
  // Suggest property names from schema
  const path = getJsonPath(node, doc);
  const existingProperties = getExistingProperties(node, doc);
  const completions = extractPropertyCompletions(
    schema,
    path,
    existingProperties,
  );

  if (completions.length > 0) {
    // Find the start of the current word
    const word = context.matchBefore(/[\w$"]*$/);
    return {
      from: word ? word.from : context.pos,
      options: completions,
      validFor: /^[\w$"]*$/,
    };
  }

  return null;
}

/**
 * Completes property values based on JSON schema
 */
function completePropertyValue(
  node: SyntaxNode,
  doc: Text,
  context: CompletionContext,
  schema: object,
): CompletionResult | null {
  // Suggest values based on property type/enum
  const path = getJsonPath(node, doc);
  const propertyName = getPropertyName(node, doc);

  if (propertyName) {
    // If the path already includes the current property name, strip it
    // to ensure we resolve against the parent object schema
    const parentPath =
      path[path.length - 1] === propertyName ? path.slice(0, -1) : path;

    const completions = extractValueCompletions(
      schema,
      parentPath,
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

  return null;
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
function getJsonPath(node: SyntaxNode, doc: Text): string[] {
  const path: string[] = [];

  let current: SyntaxNode | null = node;

  while (current) {
    if (current.name === 'Property') {
      // Get the property name
      const propertyName = getPropertyName(current, doc);
      if (propertyName) {
        path.unshift(propertyName);
      }
    }

    current = current.parent;
  }

  return path;
}

/**
 * Gets existing property names in the current object
 */
function getExistingProperties(node: SyntaxNode, doc: Text): Set<string> {
  const properties = new Set<string>();

  // Find the parent Object node
  let current: SyntaxNode | null = node;
  while (current && current.name !== 'Object') {
    current = current.parent;
  }

  if (!current) {
    return properties;
  }

  // Iterate through all Property children of this Object
  let child = current.firstChild;
  while (child) {
    if (child.name === 'Property') {
      const propName = getPropertyName(child, doc);
      if (propName) {
        properties.add(propName);
      }
    }
    child = child.nextSibling;
  }

  return properties;
}

/**
 * Gets the property name from a Property node
 */
function getPropertyName(node: SyntaxNode, doc: Text): string | null {
  let targetNode = node;

  // If not already a PropertyName node, try to find one
  if (targetNode.name !== 'PropertyName') {
    const propertyNameNode = findChildByName(targetNode, 'PropertyName');
    if (!propertyNameNode) {
      return null;
    }
    targetNode = propertyNameNode;
  }

  const text = doc.sliceString(targetNode.from, targetNode.to);
  if (!text) {
    return null;
  }

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
    if (child.name === name) {
      return child;
    }
    child = child.nextSibling;
  }
  return undefined;
}

type Schema = {
  properties?: Record<string, Schema>;
  type?: string | string[];
  enum?: string[];
};

/**
 * Navigates to a schema at the given path
 */
function navigateToSchemaPath(schema: any, path: string[]): Schema {
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

  // If we end up at an array schema, use its items
  if (currentSchema.type === 'array' && currentSchema.items) {
    currentSchema = currentSchema.items;
  }

  return currentSchema;
}

/**
 * Extracts property name completions from schema at the given path
 */
function extractPropertyCompletions(
  schema: any,
  path: string[],
  existingProperties: Set<string>,
): Completion[] {
  const currentSchema = navigateToSchemaPath(schema, path);

  if (!currentSchema.properties) {
    return [];
  }

  return Object.entries(currentSchema.properties)
    .filter(([key]) => !existingProperties.has(key))
    .map(([key, propSchema]) => {
      const typed = propSchema as any;
      return {
        label: `"${key}"`,
        type: 'property',
        detail: typed.type || 'any',
        info: typed.description,
        apply: `"${key}": `,
      };
    });
}

/**
 * Extracts value completions from schema based on property type
 */
function extractValueCompletions(
  schema: any,
  path: string[],
  propertyName: string,
): Completion[] {
  const currentSchema = navigateToSchemaPath(schema, path);

  const propertySchema = currentSchema.properties?.[propertyName];

  if (!propertySchema) {
    return [];
  }

  const completions: Completion[] = [];

  // Get type detail string for display
  const typeDetail = Array.isArray(propertySchema.type)
    ? propertySchema.type.join(', ')
    : propertySchema.type || 'any';

  // Handle enum values
  if (propertySchema.enum && Array.isArray(propertySchema.enum)) {
    return propertySchema.enum.map((value) => ({
      label: JSON.stringify(value),
      type: 'enum',
      detail: typeDetail,
      apply: JSON.stringify(value),
    }));
  }

  // Get types as array
  const types = Array.isArray(propertySchema.type)
    ? propertySchema.type
    : [propertySchema.type];

  // Add boolean completions if type includes boolean
  if (types.includes('boolean')) {
    completions.push(
      {
        label: 'true',
        type: 'keyword',
        detail: typeDetail,
        apply: 'true',
      },
      {
        label: 'false',
        type: 'keyword',
        detail: typeDetail,
        apply: 'false',
      },
    );
  }

  // Add null completion if type includes null
  if (types.includes('null')) {
    completions.push({
      label: 'null',
      type: 'keyword',
      detail: typeDetail,
      apply: 'null',
    });
  }

  return completions;
}
