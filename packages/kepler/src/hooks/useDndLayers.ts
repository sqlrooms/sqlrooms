import {useCallback, useState} from 'react';
import {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import {layerConfigChange, reorderLayer, toggleLayerForMap} from '@kepler.gl/actions';
import {reorderLayerOrder} from '@kepler.gl/reducers';
import {Layer} from '@kepler.gl/layers';
import {useStoreWithKepler} from '../KeplerSlice';

// TODO import from @kepler.gl/components once 3.1.10 release is available
const DROPPABLE_MAP_CONTAINER_TYPE = 'map';
const SORTABLE_LAYER_TYPE = 'layer';
const SORTABLE_SIDE_PANEL_TYPE = 'root';

type DndEffectsHook = {
  activeLayer: Layer | undefined;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

const useDndLayers: (mapId: string, layers: Layer[], layerOrder: string[]) => DndEffectsHook = (
  mapId,
  layers,
  layerOrder
) => {
  const dispatch = useStoreWithKepler(
    (state) => state.kepler.dispatchAction,
  );

  const [activeLayer, setActiveLayer]: [
    activeEffect: Layer | undefined,
    setActiveEffect: (effect: Layer | undefined) => void
  ] = useState();

  const onDragStart = useCallback(
    (event: any) => {
      const {active} = event;
      const newActiveLayer = layers.find(layer => layer.id === active.id);
      if (newActiveLayer) {
        setActiveLayer(newActiveLayer);
        if (newActiveLayer?.config.isConfigActive) {
          dispatch(mapId, layerConfigChange(newActiveLayer, {isConfigActive: false}));
        }
      }
    },
    [dispatch, layers, mapId]
  );

  const onDragEnd = useCallback(
    (event: any) => {
      const {active, over} = event;

      const {id: activeLayerId} = active;
      const overType = over?.data?.current?.type;

      if (!overType) {
        setActiveLayer(undefined);
        return;
      }

      switch (overType) {
        // moving layers into maps
        case DROPPABLE_MAP_CONTAINER_TYPE: {
          const mapIndex = over.data.current?.index ?? 0;
          dispatch(mapId, toggleLayerForMap(mapIndex, activeLayerId));
          break;
        }
        // swaping layers
        case SORTABLE_LAYER_TYPE: {
          const newLayerOrder = reorderLayerOrder(layerOrder, activeLayerId, over.id);
          dispatch(mapId, reorderLayer(newLayerOrder));
          break;
        }
        //  moving layers within side panel
        case SORTABLE_SIDE_PANEL_TYPE:
          // move layer to the end of the list
                      dispatch(
              mapId,
              reorderLayer(
                reorderLayerOrder(layerOrder, activeLayerId, layerOrder[layerOrder.length - 1] || '')
              )
            );
          break;
        default:
          break;
      }

      setActiveLayer(undefined);
    },
    [dispatch, layerOrder, mapId]
  );

  return {activeLayer, onDragStart, onDragEnd};
};

export default useDndLayers; 