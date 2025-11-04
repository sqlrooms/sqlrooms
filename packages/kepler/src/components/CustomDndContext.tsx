import React, {useCallback, useMemo, PropsWithChildren} from 'react';
import styled from 'styled-components';
import {DndContext as DndKitContext, DragOverlay} from '@dnd-kit/core';
import {VisState} from '@kepler.gl/schemas';
import {
  LayerPanelHeaderFactory,
  DND_MODIFIERS,
  DND_EMPTY_MODIFIERS,
  SORTABLE_LAYER_TYPE,
  SORTABLE_EFFECT_TYPE,
} from '@kepler.gl/components';

import useDndLayers from '../hooks/useDndLayers';
import useDndEffects from '../hooks/useDndEffects';
import {useStoreWithKepler} from '../KeplerSlice';

const DragItem = styled.div`
  cursor: grabbing;
`;

const nop = () => {};

export type DndContextProps = PropsWithChildren<{
  visState?: VisState;
}>;

export function CustomDndContextFactory(
  LayerPanelHeader: ReturnType<typeof LayerPanelHeaderFactory>,
): React.FC<DndContextProps> {
  const LayerPanelOverlay = ({
    layer,
    datasets,
  }: {
    layer: any;
    datasets: any;
  }) => {
    const color =
      layer.config.dataId && datasets[layer.config.dataId]
        ? datasets[layer.config.dataId].color
        : null;
    return (
      <LayerPanelHeader
        isConfigActive={false}
        layerId={layer.id}
        isVisible={true}
        isValid={true}
        label={layer.config.label}
        labelRCGColorValues={color}
        onToggleVisibility={nop}
        onResetIsValid={nop}
        onUpdateLayerLabel={nop}
        onToggleEnableConfig={nop}
        onDuplicateLayer={nop}
        onRemoveLayer={nop}
        onZoomToLayer={nop}
        layerType={layer.type}
        allowDuplicate={false}
        isDragNDropEnabled={false}
      />
    );
  };

  const DndContext = ({children, visState}: DndContextProps) => {
    // Get the current map ID from the store
    const mapId = useStoreWithKepler(
      (state: any) => state.config.kepler.currentMapId,
    );
    const {datasets, layerOrder, layers, splitMaps, effects, effectOrder} =
      visState || {};

    // Use our custom hooks that include mapId
    const {
      activeLayer,
      onDragStart: onLayerDragStart,
      onDragEnd: onLayerDragEnd,
    } = useDndLayers(mapId, layers || [], layerOrder || []);

    const {onDragStart: onEffectDragStart, onDragEnd: onEffectDragEnd} =
      useDndEffects(mapId, effects || [], effectOrder || []);

    const isSplit = useMemo(() => (splitMaps?.length || 0) > 1, [splitMaps]);
    const dndModifiers = useMemo(
      () => (isSplit ? DND_EMPTY_MODIFIERS : DND_MODIFIERS),
      [isSplit],
    );

    const onDragStart = useCallback(
      (event: any) => {
        const activeType = event.active.data?.current?.type;
        switch (activeType) {
          case SORTABLE_LAYER_TYPE:
            onLayerDragStart(event);
            break;
          case SORTABLE_EFFECT_TYPE:
            onEffectDragStart(event);
            break;
          default:
            console.log(`activeType ${activeType} unknown`);
        }
      },
      [onLayerDragStart, onEffectDragStart],
    );

    const onDragEnd = useCallback(
      (event: any) => {
        const activeType = event.active.data?.current?.type;
        switch (activeType) {
          case SORTABLE_LAYER_TYPE:
            onLayerDragEnd(event);
            break;
          case SORTABLE_EFFECT_TYPE:
            onEffectDragEnd(event);
            break;
          default:
            console.log(`activeType ${activeType} unknown`);
        }
      },
      [onLayerDragEnd, onEffectDragEnd],
    );

    return (
      <DndKitContext
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        modifiers={dndModifiers}
      >
        {children}
        {activeLayer ? (
          <DragOverlay modifiers={dndModifiers} dropAnimation={null}>
            <DragItem>
              <LayerPanelOverlay layer={activeLayer} datasets={datasets} />
            </DragItem>
          </DragOverlay>
        ) : null}
      </DndKitContext>
    );
  };

  return DndContext;
}

CustomDndContextFactory.deps = [LayerPanelHeaderFactory];
