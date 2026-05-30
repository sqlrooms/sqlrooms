import type * as arrow from 'apache-arrow';

const GEOARROW_COMPILED_ACCESSOR = Symbol.for(
  '@sqlrooms/deck/compiled-geoarrow-accessor',
);

function isValidIdentifier(name: string) {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

const RESERVED_IDENTIFIERS = new Set([
  // JS keywords & future reserved words
  'abstract',
  'arguments',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  // Literals & globals used in expressions
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'Math',
  'Number',
  'String',
  'Boolean',
  'Array',
  'Object',
  'Date',
  // Accessor runtime parameter
  'target',
]);

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function resolveColumnBindings(expression: string, table: arrow.Table) {
  const schemaFieldNames = table.schema.fields
    .map((field) => field.name)
    .filter(isValidIdentifier);

  const identifiers = unique(
    Array.from(expression.matchAll(/\b[A-Za-z_$][\w$]*\b/g))
      .map((match) => match[0])
      .filter((identifier) => !RESERVED_IDENTIFIERS.has(identifier)),
  );

  return identifiers.map((identifier) => {
    const exactMatch = schemaFieldNames.find(
      (fieldName) => fieldName === identifier,
    );
    if (exactMatch) {
      return {identifier, columnName: exactMatch};
    }

    const caseInsensitiveMatches = schemaFieldNames.filter(
      (fieldName) => fieldName.toLowerCase() === identifier.toLowerCase(),
    );

    return {
      identifier,
      columnName:
        caseInsensitiveMatches.length === 1
          ? caseInsensitiveMatches[0]!
          : undefined,
    };
  });
}

function copyArrayLikeIntoTarget(result: unknown) {
  if (!Array.isArray(result) && !ArrayBuffer.isView(result)) {
    return result;
  }

  // TODO(geoarrow-upgrade): Keep returning plain JS arrays for 0.3.x. Reusing deck's
  // typed `target` buffer here caused `ScatterplotLayer` binary attribute errors
  // (`Float64Array`) when GeoArrow delegated to deck sublayers. If the next GeoArrow
  // runtime changes the callback contract, re-evaluate whether target reuse is safe.
  return Array.from(result as ArrayLike<number>);
}

export function compileGeoArrowAccessor(
  expression: string,
  table: arrow.Table,
) {
  const trimmedExpression = expression.trim();
  if (trimmedExpression === '-') {
    const accessor = ({
      index,
      data,
    }: {
      index: number;
      data: {data: {get: (i: number) => unknown}};
    }) => data.data.get(index);
    Object.defineProperty(accessor, GEOARROW_COMPILED_ACCESSOR, {
      value: true,
      enumerable: false,
    });
    return accessor;
  }

  const bindings = resolveColumnBindings(trimmedExpression, table);

  const evaluator = new Function(
    ...bindings.map((binding) => binding.identifier),
    'target',
    `return (${trimmedExpression});`,
  ) as (...args: unknown[]) => unknown;

  // TODO(geoarrow-upgrade): This custom evaluator exists because published 0.3.x
  // GeoArrow callbacks are batch-oriented rather than deck.gl/json row-oriented. If
  // the next version aligns with deck.gl/json accessors, remove this compiler and
  // let the standard JSON conversion pipeline handle expressions.
  const accessor = ({
    index,
    data,
    target,
  }: {
    index: number;
    data: {data: {get: (i: number) => Record<string, unknown>}};
    target: number[];
  }) => {
    const batch = data.data as arrow.Table | arrow.RecordBatch;
    const args = bindings.map((binding) =>
      binding.columnName
        ? batch.getChild(binding.columnName)?.get(index)
        : undefined,
    );
    const result = evaluator(...args, target);
    return copyArrayLikeIntoTarget(result);
  };

  Object.defineProperty(accessor, GEOARROW_COMPILED_ACCESSOR, {
    value: true,
    enumerable: false,
  });

  return accessor;
}

export function isCompiledGeoArrowAccessor(
  value: unknown,
): value is (info: {
  index: number;
  data: {data: unknown};
  target: number[];
}) => unknown {
  return (
    typeof value === 'function' &&
    Boolean(
      (value as {[GEOARROW_COMPILED_ACCESSOR]?: boolean})[
        GEOARROW_COMPILED_ACCESSOR
      ],
    )
  );
}
