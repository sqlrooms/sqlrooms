import {
  promoteContextSelectorItem,
  reorderContextSelectorItems,
  toggleContextSelectorItem,
} from '../src/components/ContextSelector';

describe('ContextSelector selection helpers', () => {
  it('adds and removes selected ids without changing order', () => {
    expect(toggleContextSelectorItem(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleContextSelectorItem(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('promotes an item to main without duplicating it', () => {
    expect(promoteContextSelectorItem(['a', 'b', 'c'], 'c')).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(promoteContextSelectorItem(['a', 'b'], 'c')).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('reorders selected ids', () => {
    expect(reorderContextSelectorItems(['a', 'b', 'c'], 'c', 'a')).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(reorderContextSelectorItems(['a', 'b', 'c'], 'x', 'a')).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
