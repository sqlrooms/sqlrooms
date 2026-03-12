import Ajv, {ValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

export function createJsonSchemaValidator(schema: object): ValidateFunction {
  const ajv = new Ajv({
    allErrors: true,
    validateSchema: false,
    allowUnionTypes: true, // Support union types like ['string', 'null']
    strictSchema: false, // Allow unknown keywords and formats (e.g., Vega-Lite's custom formats)
    strictTypes: false, // Don't require explicit types when using keywords like minimum/maximum
    validateFormats: false, // Don't validate format keywords, just schema structure
    logger: false, // Disable console warnings for strict mode issues
  });

  addFormats(ajv);

  return ajv.compile(schema);
}
