import {createQueryTool} from '../src/tools/query/queryTool';
import {expect, it, jest} from '@jest/globals';
import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {StoreApi} from '@sqlrooms/room-shell';

it.each(['INSERT_QUERY_NODE', 'DELETE_QUERY_NODE', 'UPDATE_QUERY_NODE'])(
  'rejects %s inside a SELECT before executing it',
  async (type) => {
    const query = jest.fn();
    const store = {
      getState: () => ({
        db: {
          getConnector: async () => ({query}),
          sqlSelectToJson: async () => ({
            error: false,
            statements: [
              {
                node: {
                  type: 'SELECT_NODE',
                  cte_map: {query_node: {type}},
                },
              },
            ],
          }),
        },
      }),
    } as unknown as StoreApi<AiSliceState & DuckDbSliceState>;
    const tool = createQueryTool(store);
    const result = await tool.execute!(
      {
        type: 'query',
        sqlQuery: 'WITH changed AS (...) SELECT 1',
        reasoning: 'test',
      },
      {
        toolCallId: 'test',
        messages: [],
      },
    );
    expect(result).toMatchObject({
      success: false,
      error: 'Query is not a valid SELECT statement',
    });
    expect(query).not.toHaveBeenCalled();
  },
);
