import {validateJsonSchema} from '../src/utils/validate-json-schema';

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

      const text = JSON.stringify({name: 'John', age: 30}, null, 2);
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for empty text', () => {
      const schema = {type: 'object'};
      const diagnostics = validateJsonSchema('', schema);

      expect(diagnostics).toEqual([]);
    });

    it('should return no diagnostics for whitespace-only text', () => {
      const schema = {type: 'object'};
      const diagnostics = validateJsonSchema('   \n\t  ', schema);

      expect(diagnostics).toEqual([]);
    });
  });

  describe('invalid JSON syntax', () => {
    it('should return diagnostic for invalid JSON syntax', () => {
      const schema = {type: 'object'};
      const text = '{invalid json}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Invalid JSON');
    });

    it('should return diagnostic for unclosed braces', () => {
      const schema = {type: 'object'};
      const text = '{"name": "John"';
      const diagnostics = validateJsonSchema(text, schema);

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

      const text = '{}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        "missing required property 'name'",
      );
    });

    it('should return diagnostic for wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number'},
        },
      };

      const text = '{"age": "not a number"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('should be number');
    });

    it('should return diagnostic for enum violation', () => {
      const schema = {
        type: 'object',
        properties: {
          status: {type: 'string', enum: ['active', 'inactive']},
        },
      };

      const text = '{"status": "pending"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('should be one of');
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

      const text = '{"age": 10}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('should be >= 18');
    });

    it('should return diagnostic for maximum value violation', () => {
      const schema = {
        type: 'object',
        properties: {
          age: {type: 'number', maximum: 100},
        },
      };

      const text = '{"age": 150}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('should be <= 100');
    });

    it('should return diagnostic for minLength violation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', minLength: 3},
        },
      };

      const text = '{"name": "ab"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        'should be at least 3 characters',
      );
    });

    it('should return diagnostic for maxLength violation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string', maxLength: 5},
        },
      };

      const text = '{"name": "toolong"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        'should be at most 5 characters',
      );
    });

    it('should return diagnostic for pattern violation', () => {
      const schema = {
        type: 'object',
        properties: {
          email: {type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$'},
        },
      };

      const text = '{"email": "invalid"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('should match pattern');
    });

    it('should return diagnostic for additional properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        additionalProperties: false,
      };

      const text = '{"name": "John", "extra": "value"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain(
        "should not have additional property 'extra'",
      );
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

      const text = '{"age": -5}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics.length).toBeGreaterThan(0);
      const messages = diagnostics.map((d) => d.message);
      expect(
        messages.some((m) => m.includes("missing required property 'name'")),
      ).toBe(true);
      expect(messages.some((m) => m.includes('should be >= 0'))).toBe(true);
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

      const text = '{"user": {"age": 30}}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toContain(
        "missing required property 'name'",
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

      const text = '[{"id": 1}, {"name": "invalid"}]';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toContain(
        "missing required property 'id'",
      );
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

      const text = '{\n  "age": 30\n}';
      const diagnostics = validateJsonSchema(text, schema);

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

      const text = '{"email": "not-an-email"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
    });

    it('should validate date-time format', () => {
      const schema = {
        type: 'object',
        properties: {
          timestamp: {type: 'string', format: 'date-time'},
        },
      };

      const text = '{"timestamp": "not-a-date"}';
      const diagnostics = validateJsonSchema(text, schema);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
    });
  });

  describe('error handling', () => {
    it('should handle broken/invalid schema gracefully', () => {
      // Schema with invalid type reference
      const brokenSchema = {
        type: 'object',
        properties: {
          name: {type: 'invalid-type' as any},
        },
      };

      const text = '{"name": "John"}';

      // Should not throw an error, should handle gracefully
      expect(() => validateJsonSchema(text, brokenSchema)).not.toThrow();

      const diagnostics = validateJsonSchema(text, brokenSchema);

      // Should return a diagnostic about the invalid schema
      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('error');
      expect(diagnostics[0]?.message).toContain('Invalid schema');
    });

    it('should handle schema with circular references', () => {
      const circularSchema: any = {
        type: 'object',
        properties: {
          child: {},
        },
      };
      // Create circular reference
      circularSchema.properties.child = circularSchema;

      const text = '{"child": {"child": {}}}';

      // Should not throw an error
      expect(() => validateJsonSchema(text, circularSchema)).not.toThrow();
    });

    it('should handle unexpected errors during validation', () => {
      // Empty/null schema edge case
      const text = '{"name": "John"}';
      const emptySchema = {};

      expect(() => validateJsonSchema(text, emptySchema)).not.toThrow();
      const diagnostics = validateJsonSchema(text, emptySchema);
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });
});
