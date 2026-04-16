import {LayoutNode} from '@sqlrooms/layout-config';
import {movePanel} from '../docking/dock-layout';

describe('movePanel', () => {
  it('inserts a sibling into a same-axis split with equalized sizes when needed', () => {
    const input: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'row',
      draggable: true,
      children: ['a', 'b', 'c'],
    };

    const result = movePanel(input, 'a', 'b', 'right');

    expect(result).toMatchObject({
      type: 'split',
      id: 'root',
      direction: 'row',
      children: [
        {type: 'panel', id: 'b', defaultSize: '33.3333%'},
        {type: 'panel', id: 'a', defaultSize: '33.3333%'},
        {type: 'panel', id: 'c', defaultSize: '33.3333%'},
      ],
    });
  });

  it('wraps only the hovered child when the drop axis conflicts with the parent split', () => {
    const input: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'row',
      draggable: true,
      children: ['a', 'b', 'c'],
    };

    const result = movePanel(input, 'a', 'b', 'down');

    expect(result).toMatchObject({
      type: 'split',
      id: 'root',
      direction: 'row',
      children: [
        {
          type: 'split',
          direction: 'column',
          children: [
            {type: 'panel', id: 'b', defaultSize: '50%'},
            {type: 'panel', id: 'a', defaultSize: '50%'},
          ],
        },
        'c',
      ],
    });
  });

  it('removes the source from tabs and keeps a valid activeTabIndex', () => {
    const input: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'row',
      draggable: true,
      children: [
        {
          type: 'tabs',
          id: 'dashboards',
          draggable: true,
          activeTabIndex: 1,
          children: ['alpha', 'beta', 'gamma'],
        },
        'target',
      ],
    };

    const result = movePanel(input, 'beta', 'target', 'right');

    expect(result).toMatchObject({
      type: 'split',
      id: 'root',
      direction: 'row',
      children: [
        {
          type: 'tabs',
          id: 'dashboards',
          activeTabIndex: 1,
          children: ['alpha', 'gamma'],
        },
        {type: 'panel', id: 'target', defaultSize: '33.3333%'},
        {type: 'panel', id: 'beta', defaultSize: '33.3333%'},
      ],
    });
  });
});
