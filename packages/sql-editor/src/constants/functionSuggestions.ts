// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {
  createTypedRowAccessor,
  DuckDbConnector,
  escapeVal,
} from '@sqlrooms/duckdb';
import {memoizeOnce} from '@sqlrooms/utils';

const getFunctionSuggestionsImpl = async (
  connector: DuckDbConnector,
  wordBeforeCursor: string,
  limit = 100,
): Promise<Iterable<{name: string; documentation: string}>> => {
  const result = await connector.query(
    `SELECT * FROM duckdb_functions()
     WHERE function_name ILIKE ${escapeVal(
       wordBeforeCursor.replace(/([%_\\])/g, '\\$1') + '%',
     )} ESCAPE '\\'
     AND REGEXP_MATCHES(function_name, '^[A-Z]', 'i')
     ORDER BY function_name
     LIMIT ${limit}
     `,
  );

  return Array.from(
    groupFunctionsByName(
      Array.from(createTypedRowAccessor({arrowTable: result})).map(
        ({
          function_name,
          function_type,
          return_type,
          example, // older DuckDB versions
          examples,
          parameters,
          parameter_types,
          description,
        }: Record<string, any>) => {
          return {
            name: function_name,
            type: function_type,
            returnType: return_type,
            examples:
              // older DuckDB versions have `example` string instead of `examples` array
              examples?.toArray instanceof Function
                ? examples.toArray()
                : typeof example === 'string'
                  ? [example]
                  : [],
            parameters: Array.from(parameters),
            parameterTypes: Array.from(parameter_types),
            description: description,
          };
        },
      ),
    ).entries(),
  ).map(([name, rows]) => {
    return {name, documentation: formatDocumentation(rows)};
  });
};

// Memoized version of the function
export const getFunctionSuggestions = memoizeOnce(getFunctionSuggestionsImpl);

type FunctionRow = {
  name: string;
  type: string;
  returnType: string;
  parameters: string[];
  parameterTypes: string[];
  description: string;
  examples: string[];
};

function groupFunctionsByName(
  functions: FunctionRow[],
): Map<string, FunctionRow[]> {
  return functions.reduce((acc, fn) => {
    if (!acc.has(fn.name)) {
      acc.set(fn.name, []);
    }

    acc.get(fn.name)?.push(fn);

    return acc;
  }, new Map<string, FunctionRow[]>());
}

function formatDocumentation(functions: FunctionRow[]): string {
  // if no overload, return empty string
  if (!functions.length) {
    return '';
  }

  return [
    formatSignatures(functions),
    formatDescription(functions),
    formatExamples(functions),
  ]
    .filter(Boolean)
    .join('<br>');
}

function formatDescription(functions: FunctionRow[]): string {
  // description is the same for all overloads, so we can take it from the first one
  const description = functions[0]?.description;
  return description ? `<i>${description}</i>` : '';
}

function formatExamples(functions: FunctionRow[], examplesToShow = 3): string {
  const examples = Array.from(
    new Set(functions.flatMap((fn) => fn.examples).filter(Boolean)),
  )
    .slice(0, examplesToShow)
    .join('\n');

  if (!examples) {
    return '';
  }

  return `<br><b>Examples:</b><br><pre>${examples}</pre>`;
}

function formatSignatures(
  functions: FunctionRow[],
  overloadsToShow = 3,
): string {
  const overloadToShow = functions.slice(0, overloadsToShow);

  const formattedOverloads = overloadToShow.map(formatSignature);

  // print more overloads count message
  const moreOverloadsCount = functions.length - overloadToShow.length;
  const formattedMoreOverloads = moreOverloadsCount
    ? `(+${moreOverloadsCount} more overload)`
    : '';

  // build lines array
  const lines = [
    ...formattedOverloads,
    ...(formattedMoreOverloads ? [formattedMoreOverloads] : []),
  ];

  return `<pre>${lines.filter(Boolean).join('\n')}</pre>`;
}

function formatSignature({
  name,
  parameterTypes,
  parameters,
  returnType,
}: FunctionRow): string {
  // format parameters
  const params = parameters
    .map((parameterName, index) => ({
      parameterName,
      parameterType: parameterTypes[index],
    }))
    .map(({parameterName, parameterType}) => {
      if (parameterType) {
        return `${parameterName}: ${parameterType}`;
      }
      return parameterName;
    })
    .join(', ');

  // format signature body
  const signatureBody = `${name}(${params})`;

  // if returnType is defined, add it to the signature
  if (returnType) {
    return `${signatureBody}: ${returnType}`;
  }

  return signatureBody;
}
