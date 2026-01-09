// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import { layerConfigChange, toggleMapControl } from "@kepler.gl/actions";
import { KeplerGlContext, LayerLegendContentFactory, LayerLegendHeaderFactory } from "@kepler.gl/components";
import { MapLegendProps } from "@kepler.gl/components/dist/map/map-legend";
import { DIMENSIONS } from "@kepler.gl/constants";
import { Layer } from "@kepler.gl/layers";
import { Button } from "@sqlrooms/ui";
import { ArrowDown, ArrowRight, ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { MouseEventHandler, useCallback, useContext, useRef, useState } from "react";
import { useStoreWithKepler } from "..";

const defaultActionIcons = {
  expanded: ArrowDown,
  collapsed: ArrowRight
};


CustomMapLegendFactory.deps = [LayerLegendHeaderFactory, LayerLegendContentFactory];


export function CustomMapLegendFactory(
  LayerLegendHeader: ReturnType<typeof LayerLegendHeaderFactory>,
  LayerLegendContent: ReturnType<typeof LayerLegendContentFactory>
) {
  const MapLegend: React.FC<MapLegendProps> = ({
    layers = [],
    width,
    ...restProps
  }) => {
    const containerW = width || DIMENSIONS.mapControl.width;
    const mapId = useContext(KeplerGlContext).id;
    const dispatchAction = useStoreWithKepler(
      (state) => state.kepler.dispatchAction,
    );
    const handleClose = (evt: React.MouseEvent<HTMLButtonElement>) => {
      evt.stopPropagation();
      dispatchAction(mapId, toggleMapControl('mapLegend', 0));
    };

    return (
      <div className="map-legend relative h-full overflow-hidden" style={{ width: containerW }}>
        <div className="absolute inset-0 flex flex-col">
          <div className="w-full flex items-center justify-between p-2 border-b border-muted">
            <div className="text-xs font-medium">Map Layers</div>
            <Button variant="ghost" size="xs" className="w-6 h-6" onClick={handleClose}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
          <div className="w-full flex flex-1 items-center flex-col overflow-auto">
          {layers.map((layer, index) => {
            return <LayerLegendItem key={index}
                layer={layer}
                containerW={containerW}
                {...restProps}
            />;
          })}
          </div>
        </div>
      </div>
    );
  };


  const LayerLegendItem = ({ layer, containerW, isExport,
    mapState,
    disableEdit,
    onLayerVisConfigChange,
   }: { layer: Layer; containerW: number; } & MapLegendProps) => {
    const [isExpanded, setIsExpanded] = useState(layer.config.isVisible);

    const dispatchAction = useStoreWithKepler(
      (state) => state.kepler.dispatchAction,
    );
    const scrollIntoView = useCallback(() => {
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      });
    }, []);
    
    const handleToggleExpanded: MouseEventHandler<HTMLElement> = (evt) => {
      evt.stopPropagation();
      const nextExpanded = !isExpanded;
      setIsExpanded(nextExpanded);
      if (!isExpanded) {
        scrollIntoView();
      }
    };

    const mapId = useContext(KeplerGlContext).id;
    const containerRef = useRef<HTMLDivElement>(null);
    const handleToggleVisibility = (evt: React.MouseEvent<HTMLButtonElement>) => {
      evt.stopPropagation();
      const nextVisible = !layer.config.isVisible;
      dispatchAction(mapId, layerConfigChange(layer, { isVisible: nextVisible }));
    };

    if (!layer.isValidToSave() || layer.config.hidden) {
      return null;
    }

    if (isExport && !layer.config.isVisible) {
      return null;
    }

  
    return (
      <div ref={containerRef} className="w-full flex flex-col border-b border-muted items-center">
        <style>{`.legend--layer__item .panel--header__action { display: none !important; }`}</style>
        <div className="flex flex-row gap-2 items-center w-full" onClick={handleToggleExpanded}>            
          <div className="text-xs overflow-hidden text-ellipsis whitespace-nowrap p-2 items-center cursor-pointer select-none">
            {layer.config.label}
          </div>
          <div className="flex-1" />
          <div className="flex flex-row gap-1 items-center justify-end">
            <Button className="w-7 h-7" variant="ghost" size="icon" onClick={handleToggleVisibility}>
              {layer.config.isVisible ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
            </Button>
            <Button
              className="w-7 h-7" variant="ghost" size="icon" onClick={handleToggleExpanded}
            >
              {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {isExpanded && <div className="text-xs w-full px-[8px] py-[5px]">
            <LayerLegendContent
              containerW={containerW}
              layer={layer}
              mapState={mapState}
              disableEdit={disableEdit}
              isExport={isExport}
              onLayerVisConfigChange={onLayerVisConfigChange}
              actionIcons={defaultActionIcons}
            /> 
        </div>}
      </div>
    );
  };

  MapLegend.displayName = 'MapLegend';

  return MapLegend;
}

