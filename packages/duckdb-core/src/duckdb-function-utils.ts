// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {createTypedRowAccessor} from './typedRowAccessor';
import type {Table} from 'apache-arrow';

export type FunctionSuggestion = {
  name: string;
  type?: string;
  returnType?: string | null;
  parameters?: (string | null | undefined)[] | null;
  parameterTypes?: (string | null | undefined)[] | null;
  description?: string | null;
  examples?: (string | null | undefined)[] | null;
};

export type GroupedFunctionSuggestion = {
  name: string;
  overloads: FunctionSuggestion[];
};

export function convertArrowResultToFunctionSuggestions(
  result: Table,
): FunctionSuggestion[] {
  return Array.from(
    createTypedRowAccessor({arrowTable: result}),
  ).map<FunctionSuggestion>(
    ({
      name,
      type,
      returnType,
      example, // older DuckDB versions
      examples,
      parameters,
      parameterTypes,
      description,
    }: Record<string, any>) => {
      return {
        name,
        type,
        returnType,
        examples:
          // older DuckDB versions have `example` string instead of `examples` array
          examples?.toArray instanceof Function
            ? examples.toArray()
            : typeof example === 'string'
              ? [example]
              : [],
        parameters: Array.from(parameters),
        parameterTypes: Array.from(parameterTypes),
        description: description,
      };
    },
  );
}

export function groupFunctionsByName(
  functions: FunctionSuggestion[],
): GroupedFunctionSuggestion[] {
  const groups = new Map<string, FunctionSuggestion[]>();

  for (const fn of functions) {
    const existing = groups.get(fn.name);
    if (existing) {
      existing.push(fn);
    } else {
      groups.set(fn.name, [fn]);
    }
  }

  return Array.from(groups.entries()).map(([name, overloads]) => ({
    name,
    overloads,
  }));
}
