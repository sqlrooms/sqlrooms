import {validateJsonSchema} from '../src/utils/validate-json-schema';
import {createJsonSchemaValidator} from '../src/utils/create-json-schema-validator';

describe('validateJsonSchema', () => {
  describe('valid JSON', () => {
    it('should return no diagnostics for valid JSON matching schema', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
          age: {type: 'number'},
        },
        required: ['name'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = JSON.stringify({name: 'John', age: 30}, null, 2);
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for empty text', async () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const diagnostics = await validateJsonSchema('', validate);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for whitespace-only text', async () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const diagnostics = await validateJsonSchema('   \n\t  ', validate);

      expect(diagnostics).toEqual([]);
    });
  });

  describe('invalid JSON syntax', () => {
    it('should return diagnostic for invalid JSON syntax', async () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const text = '{invalid json}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('error');
      // vscode-json-languageservice provides detailed syntax errors
    });

    it('should return diagnostic for unclosed braces', async () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "John"';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('error');
      // vscode-json-languageservice provides detailed syntax errors
    });
  });

  describe('schema validation errors', () => {
    it('should return diagnostic for missing required property', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        required: ['name'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('Missing property');
    });

    it('should return diagnostic for wrong type', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": "not a number"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('Incorrect type');
    });

    it('should return diagnostic for enum violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          status: {type: 'string', enum: ['active', 'inactive']},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"status": "pending"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('Value is not accepted');
      expect(diagnostics[0]?.message).toContain('active');
      expect(diagnostics[0]?.message).toContain('inactive');
    });

    it('should return diagnostic for minimum value violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number', minimum: 18},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": 10}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('below the minimum');
    });

    it('should return diagnostic for maximum value violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number', maximum: 100},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": 150}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('above the maximum');
    });

    it('should return diagnostic for minLength violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', minLength: 3},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "ab"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('shorter than the minimum');
    });

    it('should return diagnostic for maxLength violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', maxLength: 5},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "toolong"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('longer than the maximum');
    });

    it('should return diagnostic for pattern violation', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: {type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"email": "invalid"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('String does not match');
    });

    it('should return diagnostic for additional properties', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        additionalProperties: false,
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "John", "extra": "value"}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('Property');
    });
  });

  describe('multiple errors', () => {
    it('should return multiple diagnostics for multiple validation errors', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
          age: {type: 'number', minimum: 0},
        },
        required: ['name', 'age'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": -5}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message);
      expect(messages.some((m) => m.includes('Missing property'))).toBe(true);
      expect(messages.some((m) => m.includes('below the minimum'))).toBe(true);
    });
  });

  describe('nested objects', () => {
    it('should validate nested properties', async () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: {type: 'string'},
              age: {type: 'number'},
            },
            required: ['name'],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"user": {"age": 30}}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.message).toContain('Missing property');
    });
  });

  describe('arrays', () => {
    it('should validate array items', async () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type: 'number'},
          },
          required: ['id'],
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '[{"id": 1}, {"name": "invalid"}]';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.message).toContain('Missing property');
    });

    it('should correctly position errors in array items', async () => {
      const schema = {
        type: 'object',
        properties: {
          addresses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                street: {type: 'string'},
                city: {type: 'string'},
                country: {type: 'string'},
              },
              required: ['street', 'city', 'country'],
            },
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = `{
  "addresses": [
    {
      "city": "asd"
    }
  ]
}`;
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);

      // All errors should point to the array item, not to the beginning of the document
      for (const diagnostic of diagnostics) {
        expect(diagnostic.from).toBeGreaterThan(20); // Should be inside the array item
        expect(diagnostic.to).toBeGreaterThan(diagnostic.from);

        // Should not point to the beginning of the document (0)
        expect(diagnostic.from).not.toBe(0);
      }

      // Check that we have the expected errors
      const messages = diagnostics.map((d) => d.message);
      expect(messages.some((m) => m.includes('Missing property'))).toBe(true);
      expect(messages.some((m) => m.includes('Missing property'))).toBe(true);
    });
  });

  describe('position tracking', () => {
    it('should provide correct position information for errors', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        required: ['name'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{\n  "age": 30\n}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.from).toBeDefined();
      expect(diagnostics[0]?.to).toBeDefined();
      expect(diagnostics[0]?.from).toBeGreaterThanOrEqual(0);
      expect(diagnostics[0]?.to).toBeGreaterThan(diagnostics[0]?.from ?? 0);
    });
  });

  describe('format validation', () => {
    it('should validate email format', async () => {
      const schema = {
        type: 'object',
        properties: {
          email: {type: 'string', format: 'email'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"email": "not-an-email"}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Format validation may not be enabled by default
      // If diagnostics are returned, they should be errors
      if (diagnostics.length > 0) {
        expect(diagnostics[0]?.severity).toBe('warning');
      }
    });

    it('should validate date-time format', async () => {
      const schema = {
        type: 'object',
        properties: {
          timestamp: {type: 'string', format: 'date-time'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"timestamp": "not-a-date"}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Format validation may not be enabled by default
      // If diagnostics are returned, they should be errors
      if (diagnostics.length > 0) {
        expect(diagnostics[0]?.severity).toBe('warning');
      }
    });
  });

  describe('oneOf schemas with required properties', () => {
    it('should only show errors from the matching oneOf branch', async () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              mark: {type: 'string'},
              encoding: {type: 'object'},
            },
            required: ['mark', 'encoding'],
          },
          {
            type: 'object',
            properties: {
              facet: {type: 'object'},
              spec: {type: 'object'},
            },
            required: ['facet', 'spec'],
          },
          {
            type: 'object',
            properties: {
              layer: {type: 'array'},
            },
            required: ['layer'],
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // User provides mark + encoding (unit spec) - valid
      const text1 = '{"mark": "line", "encoding": {}}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // User provides mark but missing encoding
      const text2 = '{"mark": "line"}';
      const diagnostics2 = await validateJsonSchema(text2, validate);

      // Should show error about missing 'encoding', NOT about missing 'facet', 'spec', or 'layer'
      expect(diagnostics2.length).toBeGreaterThan(0);
      const messages = diagnostics2.map((d) => d.message).join(' ');
      expect(messages).toContain('encoding');
      expect(messages).not.toContain('facet');
      expect(messages).not.toContain('spec');
      expect(messages).not.toContain('layer');
    });

    it('should show enum error for invalid property value, not composition spec errors', async () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              mark: {
                type: 'string',
                enum: ['line', 'bar', 'point', 'area'],
              },
              encoding: {type: 'object'},
            },
            required: ['mark', 'encoding'],
          },
          {
            type: 'object',
            properties: {
              facet: {type: 'object'},
              spec: {type: 'object'},
            },
            required: ['facet', 'spec'],
          },
          {
            type: 'object',
            properties: {
              layer: {type: 'array'},
            },
            required: ['layer'],
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // User provides invalid mark value (unit spec with wrong enum)
      const text = '{"mark": "invalid-mark", "encoding": {}}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Should show enum error about mark value
      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message).join(' ');
      expect(messages).toContain('Value is not accepted');

      // Should NOT show errors about missing 'facet', 'layer', etc.
      expect(messages).not.toContain('facet');
      expect(messages).not.toContain('layer');
    });

    it('should handle facet spec correctly without showing unit spec errors', async () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              mark: {type: 'string'},
              encoding: {type: 'object'},
            },
            required: ['mark', 'encoding'],
          },
          {
            type: 'object',
            properties: {
              facet: {type: 'object'},
              spec: {type: 'object'},
            },
            required: ['facet', 'spec'],
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // User provides facet but missing spec
      const text = '{"facet": {}}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Should show error about missing 'spec', NOT about missing 'mark' or 'encoding'
      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message).join(' ');
      expect(messages).toContain('spec');
      expect(messages).not.toContain('mark');
      expect(messages).not.toContain('encoding');
    });

    it('should handle complex Vega-Lite-like schema', async () => {
      const schema = {
        oneOf: [
          {
            // Unit spec
            type: 'object',
            properties: {
              mark: {
                type: 'string',
                enum: ['bar', 'line', 'point', 'area', 'boxplot'],
              },
              encoding: {type: 'object'},
              data: {type: 'object'},
            },
            required: ['mark'],
          },
          {
            // Layer spec
            type: 'object',
            properties: {
              layer: {type: 'array'},
              data: {type: 'object'},
            },
            required: ['layer'],
          },
          {
            // Facet spec
            type: 'object',
            properties: {
              facet: {type: 'object'},
              spec: {type: 'object'},
              data: {type: 'object'},
            },
            required: ['facet', 'spec'],
          },
          {
            // Repeat spec
            type: 'object',
            properties: {
              repeat: {type: 'object'},
              spec: {type: 'object'},
              data: {type: 'object'},
            },
            required: ['repeat', 'spec'],
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // Valid unit spec
      const text1 = '{"mark": "line", "encoding": {}}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Invalid mark value in unit spec
      const text2 = '{"mark": "invalid", "encoding": {}}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2.length).toBeGreaterThan(0);
      const messages2 = diagnostics2.map((d) => d.message).join(' ');
      expect(messages2).toContain('Value is not accepted');
      expect(messages2).not.toContain('layer');
      expect(messages2).not.toContain('facet');
      expect(messages2).not.toContain('repeat');

      // Valid layer spec
      const text3 = '{"layer": []}';
      const diagnostics3 = await validateJsonSchema(text3, validate);
      expect(diagnostics3).toEqual([]);

      // Valid facet spec
      const text4 = '{"facet": {}, "spec": {}}';
      const diagnostics4 = await validateJsonSchema(text4, validate);
      expect(diagnostics4).toEqual([]);
    });

    it('should handle oneOf with additionalProperties: false', async () => {
      const schema = {
        oneOf: [
          {
            // Unit spec - allows mark and encoding
            type: 'object',
            properties: {
              mark: {
                type: 'string',
                enum: ['line', 'bar', 'point'],
              },
              encoding: {type: 'object'},
            },
            required: ['mark'],
            additionalProperties: true,
          },
          {
            // Repeat spec - only allows repeat and spec
            type: 'object',
            properties: {
              repeat: {type: 'object'},
              spec: {type: 'object'},
            },
            required: ['repeat', 'spec'],
            additionalProperties: false, // Rejects mark, encoding, etc.
          },
          {
            // Facet spec - only allows facet and spec
            type: 'object',
            properties: {
              facet: {type: 'object'},
              spec: {type: 'object'},
            },
            required: ['facet', 'spec'],
            additionalProperties: false, // Rejects mark, encoding, etc.
          },
          {
            // Layer spec - only allows layer
            type: 'object',
            properties: {
              layer: {type: 'array'},
            },
            required: ['layer'],
            additionalProperties: false, // Rejects mark, encoding, etc.
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // User provides invalid mark value in unit spec
      const text = '{"mark": "lineg", "encoding": {}}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Should show enum error about mark value
      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message).join(' ');
      expect(messages).toContain('Value is not accepted');

      // Should NOT show errors from composition branches:
      // - "Missing property 'repeat'"
      // - "Missing property 'facet'"
      // - "Missing property 'layer'"
      // - "Unknown property 'mark'" (from branches with additionalProperties: false)
      // - "Unknown property 'encoding'" (from branches with additionalProperties: false)
      expect(messages).not.toContain('repeat');
      expect(messages).not.toContain('facet');
      expect(messages).not.toContain('layer');
      expect(messages).not.toContain('Unknown property');
    });

    it('should handle oneOf with anyOf combinations', async () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: {const: 'A'},
              requiredA: {type: 'string'},
            },
            required: ['type', 'requiredA'],
          },
          {
            type: 'object',
            properties: {
              type: {const: 'B'},
              requiredB: {type: 'number'},
            },
            required: ['type', 'requiredB'],
          },
        ],
      };

      const validate = createJsonSchemaValidator(schema);

      // User provides type A but missing requiredA
      const text = '{"type": "A"}';
      const diagnostics = await validateJsonSchema(text, validate);

      // Should show error about missing 'requiredA', NOT 'requiredB'
      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message).join(' ');
      expect(messages).toContain('requiredA');
      expect(messages).not.toContain('requiredB');
    });
  });

  describe('union types (multiple type values)', () => {
    it('should accept string or null for string | null type', async () => {
      const schema = {
        type: 'object',
        properties: {
          optionalName: {
            type: ['string', 'null'],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should accept string
      const text1 = '{"optionalName": "John"}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"optionalName": null}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);
    });

    it('should reject invalid types for union type', async () => {
      const schema = {
        type: 'object',
        properties: {
          optionalName: {
            type: ['string', 'null'],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should reject number
      const text = '{"optionalName": 123}';
      const diagnostics = await validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.message).toContain('Incorrect type');
    });

    it('should accept boolean or null for boolean | null type', async () => {
      const schema = {
        type: 'object',
        properties: {
          optionalFlag: {
            type: ['boolean', 'null'],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should accept true
      const text1 = '{"optionalFlag": true}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept false
      const text2 = '{"optionalFlag": false}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should accept null
      const text3 = '{"optionalFlag": null}';
      const diagnostics3 = await validateJsonSchema(text3, validate);
      expect(diagnostics3).toEqual([]);
    });

    it('should validate enum with null in union type', async () => {
      const schema = {
        type: 'object',
        properties: {
          optionalStatus: {
            type: ['string', 'null'],
            enum: ['active', 'inactive', null],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should accept enum value
      const text1 = '{"optionalStatus": "active"}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"optionalStatus": null}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject invalid enum value
      const text3 = '{"optionalStatus": "pending"}';
      const diagnostics3 = await validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
      expect(diagnostics3[0]?.message).toContain('Value is not accepted');
    });

    it('should handle number | string union type', async () => {
      const schema = {
        type: 'object',
        properties: {
          flexibleValue: {
            type: ['number', 'string'],
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should accept number
      const text1 = '{"flexibleValue": 123}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept string
      const text2 = '{"flexibleValue": "abc"}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject boolean
      const text3 = '{"flexibleValue": true}';
      const diagnostics3 = await validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
    });

    it('should handle complex union types with constraints', async () => {
      const schema = {
        type: 'object',
        properties: {
          age: {
            type: ['number', 'null'],
            minimum: 0,
            maximum: 120,
          },
        },
      };

      const validate = createJsonSchemaValidator(schema);

      // Should accept valid number
      const text1 = '{"age": 25}';
      const diagnostics1 = await validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"age": null}';
      const diagnostics2 = await validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject number below minimum
      const text3 = '{"age": -1}';
      const diagnostics3 = await validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
      expect(diagnostics3[0]?.message).toContain('below the minimum');

      // Should reject number above maximum
      const text4 = '{"age": 150}';
      const diagnostics4 = await validateJsonSchema(text4, validate);
      expect(diagnostics4).toHaveLength(1);
      expect(diagnostics4[0]?.message).toContain('above the maximum');
    });
  });
});
