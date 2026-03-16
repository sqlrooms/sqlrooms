import {validateJsonSchema} from '../src/utils/validate-json-schema';
import {createJsonSchemaValidator} from '../src/utils/create-json-schema-validator';

describe('Vega-Lite schema integration', () => {
  let schema: object;

  beforeAll(async () => {
    // Fetch the actual Vega-Lite schema
    const response = await fetch(
      'https://vega.github.io/schema/vega-lite/v5.json',
    );
    schema = await response.json();
  }, 30000); // 30 second timeout for schema download

  it('should show only enum warning for invalid mark value, not composition warnings', async () => {
    const validate = createJsonSchemaValidator(schema);

    // Invalid mark value (should be 'line', not 'lineg')
    const text = JSON.stringify({
      title: 'Monthly Earthquake Counts',
      data: {values: []},
      mark: 'lineg', // Invalid
      encoding: {
        x: {field: 'Month', type: 'temporal'},
        y: {field: 'Count', type: 'quantitative'},
      },
    });

    const diagnostics = await validateJsonSchema(text, validate);
    const messages = diagnostics.map((d) => d.message).join(' | ');

    // Should have at least one warning (for the invalid mark)
    expect(diagnostics.length).toBeGreaterThan(0);

    // Should NOT show composition spec warnings
    expect(messages).not.toContain('repeat');
    expect(messages).not.toContain('layer');
    expect(messages).not.toContain('facet');
    expect(messages).not.toContain('concat');

    // Should NOT show "Unknown property 'mark'" or "Unknown property 'encoding'"
    expect(messages).not.toContain('Unknown property');
  });

  it('should show no warnings for valid unit spec', async () => {
    const validate = createJsonSchemaValidator(schema);

    const text = JSON.stringify({
      data: {values: []},
      mark: 'line',
      encoding: {
        x: {field: 'a', type: 'quantitative'},
      },
    });

    const diagnostics = await validateJsonSchema(text, validate);

    // Should have no diagnostics
    expect(diagnostics).toEqual([]);
  });
});
