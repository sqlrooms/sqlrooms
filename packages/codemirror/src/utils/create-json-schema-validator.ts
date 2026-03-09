import Ajv, {ValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

export function createJsonSchemaValidator(schema: object): ValidateFunction {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    validateSchema: false,
    allowUnionTypes: true, // Support union types like ['string', 'null']
  });

  addFormats(ajv);

  return ajv.compile(schema);
}
