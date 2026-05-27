// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {DuckDbConnector} from './DuckDbConnector';
import {escapeVal} from './duckdb-utils';
import {
  convertArrowResultToFunctionSuggestions,
  type GroupedFunctionSuggestion,
} from './duckdb-function-utils';

export const getFunctionDocumentation = async (
  connector: DuckDbConnector,
  functionName: string,
): Promise<GroupedFunctionSuggestion | null> => {
  const result = await connector.query(
    `SELECT
      function_name as name,
      function_type as type,
      return_type as returnType,
      parameters,
      parameter_types as parameterTypes,
      description,
      examples
    FROM duckdb_functions()
     WHERE LOWER(function_name) = LOWER(${escapeVal(functionName)})
    ORDER BY function_name`,
  );

  const overloads = convertArrowResultToFunctionSuggestions(result);

  if (overloads.length === 0) {
    return null;
  }

  const firstOverload = overloads[0];
  if (!firstOverload) {
    return null;
  }

  return {
    name: firstOverload.name,
    overloads,
  };
};
