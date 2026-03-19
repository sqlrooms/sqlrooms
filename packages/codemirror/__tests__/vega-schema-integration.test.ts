import {validateJsonSchema} from '../src/utils/validate-json-schema';
import {createJsonSchemaValidator} from '../src/utils/create-json-schema-validator';

const SCHEMA_DOWNLOAD_TIMEOUT = 30000; // 30 second timeout for schema download

describe('Vega-Lite schema integration', () => {
  let schema: object;

  beforeAll(async () => {
    // Fetch the actual Vega-Lite schema
    const response = await fetch(
      'https://vega.github.io/schema/vega-lite/v5.json',
    );
    schema = await response.json();
  }, SCHEMA_DOWNLOAD_TIMEOUT);

  it('should show only enum warning for invalid mark value, not composition warnings', async () => {
    const validate = createJsonSchemaValidator(schema);

    // Invalid mark value (should be 'line', not 'INVALID!')
    const text = JSON.stringify(
      {
        title: 'Monthly Earthquake Counts',
        data: {values: []},
        mark: 'INVALID!', // Invalid
        encoding: {
          x: {field: 'Month', type: 'temporal'},
          y: {field: 'Count', type: 'quantitative'},
        },
      },
      null,
      2,
    );

    const diagnostics = await validateJsonSchema(text, validate);

    // Should have exactly one diagnostic for the invalid mark enum value
    expect(diagnostics).toHaveLength(1);

    // Verify the diagnostic points to the "INVALID!" value
    const markValueStart = text.indexOf('"INVALID!"');
    const markValueEnd = markValueStart + '"INVALID!"'.length;

    expect(diagnostics[0]?.from).toBe(markValueStart);
    expect(diagnostics[0]?.to).toBe(markValueEnd);
    expect(diagnostics[0]?.message).toBe(
      'Value is not accepted. Valid values: "boxplot", "errorbar", "errorband".',
    );
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
