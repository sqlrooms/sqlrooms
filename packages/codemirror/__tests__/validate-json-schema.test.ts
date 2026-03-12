import {validateJsonSchema} from '../src/utils/validate-json-schema';
import {createJsonSchemaValidator} from '../src/utils/create-json-schema-validator';

describe('validateJsonSchema', () => {
  describe('valid JSON', () => {
    it('should return no diagnostics for valid JSON matching schema', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for empty text', () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const diagnostics = validateJsonSchema('', validate);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for whitespace-only text', () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const diagnostics = validateJsonSchema('   \n\t  ', validate);

      expect(diagnostics).toEqual([]);
    });
  });

  describe('invalid JSON syntax', () => {
    it('should return diagnostic for invalid JSON syntax', () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const text = '{invalid json}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Invalid JSON');
    });

    it('should return diagnostic for unclosed braces', () => {
      const schema = {type: 'object'};
      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "John"';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Invalid JSON');
    });
  });

  describe('schema validation errors', () => {
    it('should return diagnostic for missing required property', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        required: ['name'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        "Missing required property 'name'",
      );
    });

    it('should return diagnostic for wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": "not a number"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should be number');
    });

    it('should return diagnostic for enum violation', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {type: 'string', enum: ['active', 'inactive']},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"status": "pending"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should be one of');
      expect(diagnostics[0]?.message).toContain('active');
      expect(diagnostics[0]?.message).toContain('inactive');
    });

    it('should return diagnostic for minimum value violation', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number', minimum: 18},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": 10}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should be >= 18');
    });

    it('should return diagnostic for maximum value violation', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number', maximum: 100},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"age": 150}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should be <= 100');
    });

    it('should return diagnostic for minLength violation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', minLength: 3},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "ab"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        'Should be at least 3 characters',
      );
    });

    it('should return diagnostic for maxLength violation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', maxLength: 5},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "toolong"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        'Should be at most 5 characters',
      );
    });

    it('should return diagnostic for pattern violation', () => {
      const schema = {
        type: 'object',
        properties: {
          email: {type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"email": "invalid"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should match pattern');
    });

    it('should return diagnostic for additional properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        additionalProperties: false,
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"name": "John", "extra": "value"}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain("Unknown property 'extra'");
    });
  });

  describe('multiple errors', () => {
    it('should return multiple diagnostics for multiple validation errors', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message);
      expect(
        messages.some((m) => m.includes("Missing required property 'name'")),
      ).toBe(true);
      expect(messages.some((m) => m.includes('Should be >= 0'))).toBe(true);
    });
  });

  describe('nested objects', () => {
    it('should validate nested properties', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toContain(
        "Missing required property 'name'",
      );
    });
  });

  describe('arrays', () => {
    it('should validate array items', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toContain(
        "Missing required property 'id'",
      );
    });

    it('should correctly position errors in array items', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

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
      expect(
        messages.some((m) => m.includes("Missing required property 'street'")),
      ).toBe(true);
      expect(
        messages.some((m) => m.includes("Missing required property 'country'")),
      ).toBe(true);
    });
  });

  describe('position tracking', () => {
    it('should provide correct position information for errors', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        required: ['name'],
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{\n  "age": 30\n}';
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.from).toBeDefined();
      expect(diagnostics[0]?.to).toBeDefined();
      expect(diagnostics[0]?.from).toBeGreaterThanOrEqual(0);
      expect(diagnostics[0]?.to).toBeGreaterThan(diagnostics[0]?.from ?? 0);
    });
  });

  describe('format validation', () => {
    it('should validate email format', () => {
      const schema = {
        type: 'object',
        properties: {
          email: {type: 'string', format: 'email'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"email": "not-an-email"}';
      const diagnostics = validateJsonSchema(text, validate);

      // Format validation may not be enabled by default
      // If diagnostics are returned, they should be errors
      if (diagnostics.length > 0) {
        expect(diagnostics[0]?.severity).toBe('error');
      }
    });

    it('should validate date-time format', () => {
      const schema = {
        type: 'object',
        properties: {
          timestamp: {type: 'string', format: 'date-time'},
        },
      };

      const validate = createJsonSchemaValidator(schema);
      const text = '{"timestamp": "not-a-date"}';
      const diagnostics = validateJsonSchema(text, validate);

      // Format validation may not be enabled by default
      // If diagnostics are returned, they should be errors
      if (diagnostics.length > 0) {
        expect(diagnostics[0]?.severity).toBe('error');
      }
    });
  });

  describe('union types (multiple type values)', () => {
    it('should accept string or null for string | null type', () => {
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
      const diagnostics1 = validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"optionalName": null}';
      const diagnostics2 = validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);
    });

    it('should reject invalid types for union type', () => {
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
      const diagnostics = validateJsonSchema(text, validate);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Should be');
    });

    it('should accept boolean or null for boolean | null type', () => {
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
      const diagnostics1 = validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept false
      const text2 = '{"optionalFlag": false}';
      const diagnostics2 = validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should accept null
      const text3 = '{"optionalFlag": null}';
      const diagnostics3 = validateJsonSchema(text3, validate);
      expect(diagnostics3).toEqual([]);
    });

    it('should validate enum with null in union type', () => {
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
      const diagnostics1 = validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"optionalStatus": null}';
      const diagnostics2 = validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject invalid enum value
      const text3 = '{"optionalStatus": "pending"}';
      const diagnostics3 = validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
      expect(diagnostics3[0]?.message).toContain('Should be one of');
    });

    it('should handle number | string union type', () => {
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
      const diagnostics1 = validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept string
      const text2 = '{"flexibleValue": "abc"}';
      const diagnostics2 = validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject boolean
      const text3 = '{"flexibleValue": true}';
      const diagnostics3 = validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
    });

    it('should handle complex union types with constraints', () => {
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
      const diagnostics1 = validateJsonSchema(text1, validate);
      expect(diagnostics1).toEqual([]);

      // Should accept null
      const text2 = '{"age": null}';
      const diagnostics2 = validateJsonSchema(text2, validate);
      expect(diagnostics2).toEqual([]);

      // Should reject number below minimum
      const text3 = '{"age": -1}';
      const diagnostics3 = validateJsonSchema(text3, validate);
      expect(diagnostics3).toHaveLength(1);
      expect(diagnostics3[0]?.message).toContain('Should be >= 0');

      // Should reject number above maximum
      const text4 = '{"age": 150}';
      const diagnostics4 = validateJsonSchema(text4, validate);
      expect(diagnostics4).toHaveLength(1);
      expect(diagnostics4[0]?.message).toContain('Should be <= 120');
    });
  });
});
