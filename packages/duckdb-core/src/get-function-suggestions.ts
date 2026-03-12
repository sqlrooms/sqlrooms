// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {memoizeOnce} from '@sqlrooms/utils';
import {DuckDbConnector} from './DuckDbConnector';
import {escapeVal} from './duckdb-utils';
import {
  convertArrowResultToFunctionSuggestions,
  groupFunctionsByName,
  type GroupedFunctionSuggestion,
} from './duckdb-function-utils';

const MAX_LIMIT = 10000;

const getFunctionSuggestionsImpl = async (
  connector: DuckDbConnector,
  wordBeforeCursor: string,
  limit = 100,
): Promise<GroupedFunctionSuggestion[]> => {
  // Validate and sanitize limit
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, MAX_LIMIT));

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
     WHERE function_name ILIKE ${escapeVal(
       wordBeforeCursor.replace(/([%_\\])/g, '\\$1') + '%',
     )} ESCAPE '\\'
     AND REGEXP_MATCHES(function_name, '^[A-Z]', 'i')
    ORDER BY function_name
    LIMIT ${safeLimit}`,
  );

  const functions = convertArrowResultToFunctionSuggestions(result);
  return groupFunctionsByName(functions);
};

// Memoized version of the function
export const getFunctionSuggestions = memoizeOnce(getFunctionSuggestionsImpl);
