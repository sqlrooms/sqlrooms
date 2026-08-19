import type {DragEndEvent} from '@dnd-kit/core';
import {
  SORTABLE_LAYER_GROUP_DROPPABLE_TYPE,
  SORTABLE_LAYER_TYPE,
  SORTABLE_SIDE_PANEL_TYPE,
} from '@kepler.gl/components';
import type {Layer} from '@kepler.gl/layers';
import type {LayerOrder, LayerOrderGroup} from '@kepler.gl/types';
import {orderLayersForLegend} from '../src/components/CustomMapLegend';
import {getLayerOrderAfterDrag} from '../src/hooks/useDndLayers';

const group = (id: string, layerOrder: LayerOrder): LayerOrderGroup => ({
  id,
  label: id,
  isVisible: true,
  isIncludedInLegend: true,
  layerOrder,
});

const drag = (
  activeId: string,
  overId: string,
  activeParent?: LayerOrderGroup,
  overParent?: LayerOrderGroup,
  overType = SORTABLE_LAYER_TYPE,
) =>
  ({
    active: {
      id: activeId,
      data: {current: {type: SORTABLE_LAYER_TYPE, parent: activeParent}},
    },
    over: {
      id: overId,
      data: {current: {type: overType, parent: overParent}},
    },
  }) as DragEndEvent;

describe('getLayerOrderAfterDrag', () => {
  it('reorders layers within a group', () => {
    const sourceGroup = group('group-a', ['a', 'b']);
    const event = drag('a', 'b', sourceGroup, sourceGroup);

    expect(
      getLayerOrderAfterDrag([sourceGroup, 'c'], event.active, event.over),
    ).toEqual([{...sourceGroup, layerOrder: ['b', 'a']}, 'c']);
  });

  it('moves a layer across groups', () => {
    const sourceGroup = group('group-a', ['a']);
    const targetGroup = group('group-b', ['b']);
    const event = drag('a', 'b', sourceGroup, targetGroup);

    expect(
      getLayerOrderAfterDrag(
        [sourceGroup, targetGroup],
        event.active,
        event.over,
      ),
    ).toEqual([
      {...sourceGroup, layerOrder: []},
      {...targetGroup, layerOrder: ['a', 'b']},
    ]);
  });

  it('moves a grouped layer to the root end from the side panel', () => {
    const sourceGroup = group('group-a', ['a', 'b']);
    const event = drag(
      'a',
      'side-panel',
      sourceGroup,
      undefined,
      SORTABLE_SIDE_PANEL_TYPE,
    );

    expect(
      getLayerOrderAfterDrag([sourceGroup, 'c'], event.active, event.over),
    ).toEqual([{...sourceGroup, layerOrder: ['b']}, 'c', 'a']);
  });

  it('moves a root layer into an empty group', () => {
    const targetGroup = group('group-b', []);
    const event = drag(
      'a',
      'group-b',
      undefined,
      targetGroup,
      SORTABLE_LAYER_GROUP_DROPPABLE_TYPE,
    );

    expect(
      getLayerOrderAfterDrag(['a', targetGroup], event.active, event.over),
    ).toEqual([{...targetGroup, layerOrder: ['a']}]);
  });
});

describe('orderLayersForLegend', () => {
  it('uses flattened group order instead of the raw layers array', () => {
    const layers = [{id: 'a'}, {id: 'b'}, {id: 'c'}] as Layer[];
    const layerOrder = [group('group-a', ['c', 'a']), 'b'];

    expect(orderLayersForLegend(layers, layerOrder).map(({id}) => id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});
