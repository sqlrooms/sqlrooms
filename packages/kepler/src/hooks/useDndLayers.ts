import {useCallback, useState} from 'react';
import {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import {
  layerConfigChange,
  reorderLayer,
  toggleLayerForMap,
} from '@kepler.gl/actions';
import {
  addLayerOrGroupToLayerOrder,
  getIndexFromLayerEntryId,
  getLayerGroupFromLayerOrder,
  removeElementFromLayerOrder,
  reorderLayerOrder,
  updateLayerGroupInLayerOrder,
} from '@kepler.gl/reducers';
import {Layer} from '@kepler.gl/layers';
import type {LayerOrder, LayerOrderGroup} from '@kepler.gl/types';
import {
  DROPPABLE_MAP_CONTAINER_TYPE,
  SORTABLE_LAYER_GROUP_DROPPABLE_TYPE,
  SORTABLE_LAYER_TYPE,
  SORTABLE_SIDE_PANEL_TYPE,
} from '@kepler.gl/components';
import {SORTABLE_LAYER_END_TYPE} from '@kepler.gl/components/common/dnd-layer-items';
import {useStoreWithKepler} from '../KeplerSlice';

type DndEffectsHook = {
  activeLayer: Layer | undefined;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

/**
 * Computes the grouped layer order produced by a layer drag.
 *
 * Kepler 3.3 stores parent group metadata on drag items. Reordering only the
 * root array loses nested moves, so same-group, cross-group, and root moves
 * need to update the relevant hierarchy level explicitly.
 */
export function getLayerOrderAfterDrag(
  layerOrder: LayerOrder,
  active: DragEndEvent['active'],
  over: DragEndEvent['over'],
): LayerOrder | undefined {
  const activeId = active.id as string;
  const overId = over?.id as string | undefined;
  const activeParent = active.data.current?.parent as
    | LayerOrderGroup
    | undefined;
  const activeType = active.data.current?.type;
  const overParent = over?.data.current?.parent as LayerOrderGroup | undefined;
  const overType = over?.data.current?.type;

  const moveToRootEnd = () =>
    addLayerOrGroupToLayerOrder(
      removeElementFromLayerOrder(layerOrder, activeId),
      activeId,
      layerOrder.length,
    );

  if (!overId) {
    return activeParent && activeType === SORTABLE_LAYER_TYPE
      ? moveToRootEnd()
      : undefined;
  }

  if (
    overType === SORTABLE_LAYER_END_TYPE ||
    overType === SORTABLE_SIDE_PANEL_TYPE
  ) {
    return moveToRootEnd();
  }

  if (activeParent?.id === overParent?.id) {
    if (!activeParent) {
      return reorderLayerOrder(layerOrder, activeId, overId);
    }

    return updateLayerGroupInLayerOrder(layerOrder, {
      ...activeParent,
      layerOrder: reorderLayerOrder(activeParent.layerOrder, activeId, overId),
    });
  }

  if (overType === SORTABLE_LAYER_GROUP_DROPPABLE_TYPE || overParent) {
    if (activeType !== SORTABLE_LAYER_TYPE) return undefined;

    const targetGroup =
      overParent ?? getLayerGroupFromLayerOrder(layerOrder, overId);
    if (!targetGroup) return undefined;

    const targetIndex =
      overType === SORTABLE_LAYER_GROUP_DROPPABLE_TYPE
        ? 0
        : getIndexFromLayerEntryId(targetGroup.layerOrder, overId);
    const updatedTargetGroup = {
      ...targetGroup,
      layerOrder: addLayerOrGroupToLayerOrder(
        targetGroup.layerOrder,
        activeId,
        targetIndex,
      ),
    };

    return updateLayerGroupInLayerOrder(
      removeElementFromLayerOrder(layerOrder, activeId),
      updatedTargetGroup,
    );
  }

  if (!overParent) {
    const targetIndex = over!.data.current?.sortable?.index ?? 0;
    return addLayerOrGroupToLayerOrder(
      removeElementFromLayerOrder(layerOrder, activeId),
      activeId,
      targetIndex,
    );
  }

  return undefined;
}

const useDndLayers: (
  mapId: string | undefined,
  layers: Layer[],
  layerOrder: LayerOrder,
) => DndEffectsHook = (mapId, layers, layerOrder) => {
  const dispatch = useStoreWithKepler((state) => state.kepler.dispatchAction);

  const [activeLayer, setActiveLayer]: [
    activeEffect: Layer | undefined,
    setActiveEffect: (effect: Layer | undefined) => void,
  ] = useState();

  const onDragStart = useCallback(
    (event: any) => {
      const {active} = event;
      if (!mapId) return;
      const newActiveLayer = layers.find((layer) => layer.id === active.id);
      if (newActiveLayer) {
        setActiveLayer(newActiveLayer);
        if (newActiveLayer?.config.isConfigActive) {
          dispatch(
            mapId,
            layerConfigChange(newActiveLayer, {isConfigActive: false}),
          );
        }
      }
    },
    [dispatch, layers, mapId],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;
      if (!mapId) return;

      const activeLayerId = active.id as string;
      const overType = over?.data.current?.type;
      setActiveLayer(undefined);

      if (overType === DROPPABLE_MAP_CONTAINER_TYPE) {
        const mapIndex = over?.data.current?.index ?? 0;
        dispatch(mapId, toggleLayerForMap(mapIndex, activeLayerId));
        return;
      }

      const newLayerOrder = getLayerOrderAfterDrag(layerOrder, active, over);
      if (newLayerOrder) {
        dispatch(mapId, reorderLayer(newLayerOrder));
      }
    },
    [dispatch, layerOrder, mapId],
  );

  return {activeLayer, onDragStart, onDragEnd};
};

export default useDndLayers;
