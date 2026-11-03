import {isReadOnlySqlSelect} from '../sqlSelect';

const parsed = (node: unknown) => ({error: false, statements: [{node}]});

it.each([
  null,
  {},
  {error: true},
  {error: false},
  {error: false, statements: []},
])('rejects malformed or failed parser output: %p', (value) => {
  expect(isReadOnlySqlSelect(value)).toBe(false);
});

it.each([
  'SELECT_NODE',
  'SET_OPERATION_NODE',
  'RECURSIVE_CTE_NODE',
  'CTE_NODE',
])('accepts a known read query root: %s', (type) => {
  expect(isReadOnlySqlSelect(parsed({type}))).toBe(true);
});

it.each([
  'INSERT_QUERY_NODE',
  'DELETE_QUERY_NODE',
  'UPDATE_QUERY_NODE',
  'FUTURE_QUERY_NODE',
])('rejects nested writes and unknown query nodes: %s', (type) => {
  expect(
    isReadOnlySqlSelect(
      parsed({
        type: 'SELECT_NODE',
        cte_map: {map: [{value: {query_node: {type}}}]},
      }),
    ),
  ).toBe(false);
});

it.each(['children', 'arguments'])(
  'traverses nested subqueries in %s expressions',
  (key) => {
    expect(
      isReadOnlySqlSelect(
        parsed({
          type: 'SELECT_NODE',
          select_list: [
            {
              class: 'FUNCTION',
              [key]: [
                {expression: {subquery: {node: {type: 'DELETE_QUERY_NODE'}}}},
              ],
            },
          ],
        }),
      ),
    ).toBe(false);
  },
);

it('rejects multiple statements', () => {
  expect(
    isReadOnlySqlSelect({
      error: false,
      statements: [
        {node: {type: 'SELECT_NODE'}},
        {node: {type: 'SELECT_NODE'}},
      ],
    }),
  ).toBe(false);
});
