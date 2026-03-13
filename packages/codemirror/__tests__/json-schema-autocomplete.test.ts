import {EditorState} from '@codemirror/state';
import {json} from '@codemirror/lang-json';
import {jsonSchemaAutocomplete} from '../src/extensions/json-schema-autocomplete';
import {CompletionContext, CompletionResult} from '@codemirror/autocomplete';

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Full name of the user',
    },
    email: {
      type: 'string',
      description: 'Email address',
    },
    age: {
      type: 'number',
      description: 'Age in years',
    },
    status: {
      type: 'string',
      description: 'Account status',
      enum: ['active', 'inactive', 'pending', 'suspended'],
    },
    premium: {
      type: 'boolean',
      description: 'Premium membership status',
    },
    settings: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
        },
      },
    },
  },
} as const;

/**
 * Helper to get completions at a specific position in the document
 */
function getCompletions(
  text: string,
  pos: number,
  schema: object,
): CompletionResult | null {
  const autocompleteExt = jsonSchemaAutocomplete(schema);
  const state = EditorState.create({
    doc: text,
    extensions: [json(), autocompleteExt],
  });

  const context = new CompletionContext(state, pos, false);

  // Extract the completion source from the autocomplete configuration
  const config = Array.isArray(autocompleteExt)
    ? autocompleteExt.find((ext) => ext.value?.override)
    : null;

  if (!config?.value?.override?.[0]) {
    return null;
  }

  const completionSource = config.value.override[0];
  return completionSource(context);
}

/**
 * Helper to extract completion labels
 */
function getCompletionLabels(
  text: string,
  pos: number,
  schema: object,
): string[] {
  const result = getCompletions(text, pos, schema);
  return result?.options?.map((opt) => opt.label) ?? [];
}

describe('jsonSchemaAutocomplete', () => {
  describe('root level property completions', () => {
    it('should suggest all root properties in empty object', () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('"name"');
      expect(labels).toContain('"email"');
      expect(labels).toContain('"age"');
      expect(labels).toContain('"status"');
      expect(labels).toContain('"premium"');
      expect(labels).toContain('"settings"');
    });

    it('should exclude already-defined root properties', () => {
      const text = '{"name": "John",|}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).not.toContain('"name"');
      expect(labels).toContain('"email"');
      expect(labels).toContain('"age"');
    });

    it('should exclude multiple already-defined properties', () => {
      const text = '{"name": "John","email": "test@example.com",|}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).not.toContain('"name"');
      expect(labels).not.toContain('"email"');
      expect(labels).toContain('"age"');
      expect(labels).toContain('"status"');
    });

    it('should include property descriptions in completion info', () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      const nameCompletion = result?.options?.find(
        (opt) => opt.label === '"name"',
      );
      expect(nameCompletion?.info).toBe('Full name of the user');

      const emailCompletion = result?.options?.find(
        (opt) => opt.label === '"email"',
      );
      expect(emailCompletion?.info).toBe('Email address');
    });

    it('should include property types in completion details', () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      const nameCompletion = result?.options?.find(
        (opt) => opt.label === '"name"',
      );
      expect(nameCompletion?.detail).toBe('string');

      const ageCompletion = result?.options?.find(
        (opt) => opt.label === '"age"',
      );
      expect(ageCompletion?.detail).toBe('number');
    });
  });

  describe('nested property completions', () => {
    it('should suggest nested properties inside settings object', () => {
      const text = '{"settings": {|}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('"theme"');
      expect(labels).toContain('"notifications"');
      expect(labels).not.toContain('"name"'); // root property
      expect(labels).not.toContain('"email"'); // root property
    });

    it('should exclude already-defined nested properties', () => {
      const text = '{"settings": {"theme": "dark", |}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).not.toContain('"theme"');
      expect(labels).toContain('"notifications"');
    });

    it('should handle deeply nested objects', () => {
      const deepSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  deepProp: {type: 'string'},
                },
              },
            },
          },
        },
      };

      const text = '{"level1": {"level2": {|}}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, deepSchema);

      expect(labels).toContain('"deepProp"');
    });
  });

  describe('value completions', () => {
    it('should suggest enum values for status field', () => {
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('"active"');
      expect(labels).toContain('"inactive"');
      expect(labels).toContain('"pending"');
      expect(labels).toContain('"suspended"');
    });

    it('should suggest boolean values for premium field', () => {
      const text = '{"premium": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('true');
      expect(labels).toContain('false');
    });

    it('should suggest enum values for nested properties', () => {
      const text = '{"settings": {"theme": |}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('"light"');
      expect(labels).toContain('"dark"');
      expect(labels).toContain('"auto"');
    });

    it('should suggest boolean values for nested properties', () => {
      const text = '{"settings": {"notifications": |}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toContain('true');
      expect(labels).toContain('false');
    });

    it('should handle null type', () => {
      const schemaWithNull = {
        type: 'object',
        properties: {
          optional: {
            type: 'null',
          },
        },
      };

      const text = '{"optional": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, schemaWithNull);

      expect(labels).toContain('null');
    });

    it('should not suggest value completions for non-enum strings', () => {
      const text = '{"name": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      // Should return null or empty for non-enum string types
      expect(result?.options?.length || 0).toBe(0);
    });

    it('should not suggest value completions for numbers', () => {
      const text = '{"age": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      // Should return null or empty for number types
      expect(result?.options?.length || 0).toBe(0);
    });
  });

  describe('completion context detection', () => {
    it('should detect property key position after opening brace', () => {
      const text = '{|';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest property keys, not values
      expect(labels).toContain('"name"');
      expect(labels).not.toContain('true');
      expect(labels).not.toContain('false');
    });

    it('should detect value position after colon', () => {
      const text = '{"premium": |';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest values, not property keys
      expect(labels).toContain('true');
      expect(labels).toContain('false');
      expect(labels).not.toContain('"name"');
    });

    it('should detect property key position after comma', () => {
      const text = '{"name": "John",|';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest property keys
      expect(labels).toContain('"email"');
      expect(labels).not.toContain('true');
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const emptySchema = {};
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, emptySchema);

      expect(result?.options?.length || 0).toBe(0);
    });

    it('should handle schema without properties', () => {
      const schemaWithoutProps = {
        type: 'object',
      };
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, schemaWithoutProps);

      expect(result?.options?.length || 0).toBe(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const text = '{invalid|';
      const pos = text.indexOf('|');

      // Should not throw an error
      expect(() => getCompletions(text, pos, TEST_SCHEMA)).not.toThrow();
    });

    it('should handle completion at start of document', () => {
      const text = '|';
      const pos = text.indexOf('|');

      // Should not throw an error
      expect(() => getCompletions(text, pos, TEST_SCHEMA)).not.toThrow();
    });

    it('should handle completion in array context', () => {
      const arraySchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type: 'number'},
            name: {type: 'string'},
          },
        },
      };

      const text = '[{|}]';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, arraySchema);

      expect(labels).toContain('"id"');
      expect(labels).toContain('"name"');
    });
  });

  describe('completion application', () => {
    it('should apply property completion with colon and space', () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      const nameCompletion = result?.options?.find(
        (opt) => opt.label === '"name"',
      );
      expect(nameCompletion?.apply).toBe('"name": ');
    });

    it('should apply enum value completion with quotes', () => {
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      const activeCompletion = result?.options?.find(
        (opt) => opt.label === '"active"',
      );
      expect(activeCompletion?.apply).toBe('"active"');
    });

    it('should apply boolean completion without quotes', () => {
      const text = '{"premium": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, TEST_SCHEMA);

      const trueCompletion = result?.options?.find(
        (opt) => opt.label === 'true',
      );
      expect(trueCompletion?.apply).toBe('true');
    });
  });

  describe('path resolution bug fixes', () => {
    it('should correctly resolve value completions without double-nesting', () => {
      // This test verifies the fix for the first bug (parent path stripping)
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should find the enum values for status
      expect(labels).toContain('"active"');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should correctly extract property name from Property nodes', () => {
      // This test verifies the fix for the second bug (PropertyName extraction)
      const text = '{"settings": {|}}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should find nested properties, not root properties
      expect(labels).toContain('"theme"');
      expect(labels).toContain('"notifications"');
      expect(labels).not.toContain('"name"');
      expect(labels).not.toContain('"email"');
    });
  });

  describe('union types (multiple type values)', () => {
    it('should suggest null for string | null type', () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalName: {
            type: ['string', 'null'],
            description: 'Optional name field',
          },
        },
      };

      const text = '{"optionalName": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toContain('null');
    });

    it('should suggest true, false, and null for boolean | null type', () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalFlag: {
            type: ['boolean', 'null'],
          },
        },
      };

      const text = '{"optionalFlag": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toContain('true');
      expect(labels).toContain('false');
      expect(labels).toContain('null');
    });

    it('should suggest enum values and null for enum with null type', () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalStatus: {
            type: ['string', 'null'],
            enum: ['active', 'inactive', null],
          },
        },
      };

      const text = '{"optionalStatus": |}';
      const pos = text.indexOf('|');
      const labels = getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toContain('"active"');
      expect(labels).toContain('"inactive"');
      expect(labels).toContain('null');
    });

    it('should not suggest completions for number | string union without enum', () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          flexibleValue: {
            type: ['number', 'string'],
          },
        },
      };

      const text = '{"flexibleValue": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, schemaWithUnion);

      // No suggestions for non-enum, non-boolean, non-null types
      expect(result?.options?.length || 0).toBe(0);
    });

    it('should handle union type detail display', () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalName: {
            type: ['string', 'null'],
            enum: ['test', null],
          },
        },
      };

      const text = '{"optionalName": |}';
      const pos = text.indexOf('|');
      const result = getCompletions(text, pos, schemaWithUnion);

      const testCompletion = result?.options?.find(
        (opt) => opt.label === '"test"',
      );

      // Should show the union type in detail
      expect(testCompletion?.detail).toBe('string, null');
    });
  });
});
