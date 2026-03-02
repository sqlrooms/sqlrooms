import {getRenderableDependencyEdges} from '../src/dagUtils';
import type {Sheet} from '../src/types';

describe('getRenderableDependencyEdges', () => {
  it('renders dependency edges from graph cache when complete', () => {
    const sheet: Sheet = {
      id: 's1',
      type: 'canvas',
      title: 'Sheet 1',
      cellIds: ['a', 'b', 'c'],
      edges: [],
      graphCache: {
        dependencies: {
          a: [],
          b: ['a'],
          c: ['a', 'b'],
        },
        dependents: {
          a: ['b', 'c'],
          b: ['c'],
        },
        contentHashByCell: {},
      },
    };

    expect(getRenderableDependencyEdges(sheet)).toEqual([
      {id: 'a-b', source: 'a', target: 'b', kind: 'dependency'},
      {id: 'a-c', source: 'a', target: 'c', kind: 'dependency'},
      {id: 'b-c', source: 'b', target: 'c', kind: 'dependency'},
    ]);
  });

  it('falls back to persisted dependency edges when cache is missing', () => {
    const sheet: Sheet = {
      id: 's1',
      type: 'canvas',
      title: 'Sheet 1',
      cellIds: ['a', 'b'],
      edges: [
        {id: 'a-b', source: 'a', target: 'b', kind: 'dependency'},
        {id: 'manual-a-b', source: 'a', target: 'b', kind: 'manual'},
      ],
    };

    expect(getRenderableDependencyEdges(sheet)).toEqual([
      {id: 'a-b', source: 'a', target: 'b', kind: 'dependency'},
    ]);
  });

  it('returns empty list when cache is complete and has no dependencies', () => {
    const sheet: Sheet = {
      id: 's1',
      type: 'canvas',
      title: 'Sheet 1',
      cellIds: ['a', 'b'],
      edges: [{id: 'a-b', source: 'a', target: 'b', kind: 'dependency'}],
      graphCache: {
        dependencies: {
          a: [],
          b: [],
        },
        dependents: {},
        contentHashByCell: {},
      },
    };

    expect(getRenderableDependencyEdges(sheet)).toEqual([]);
  });
});
