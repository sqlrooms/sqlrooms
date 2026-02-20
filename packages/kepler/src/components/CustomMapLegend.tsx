// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import {layerConfigChange, toggleMapControl} from '@kepler.gl/actions';
import {
  KeplerGlContext,
  LayerLegendContentFactory,
  LayerLegendHeaderFactory,
} from '@kepler.gl/components';
import {MapLegendProps} from '@kepler.gl/components/dist/map/map-legend';
import {DIMENSIONS} from '@kepler.gl/constants';
import {Layer} from '@kepler.gl/layers';
import {Button} from '@sqlrooms/ui';
import {
  ArrowDown,
  ArrowRight,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from 'lucide-react';
import {
  MouseEventHandler,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {useStoreWithKepler} from '../KeplerSlice';

const defaultActionIcons = {
  expanded: ArrowDown,
  collapsed: ArrowRight,
};

CustomMapLegendFactory.deps = [
  LayerLegendHeaderFactory,
  LayerLegendContentFactory,
];

export function CustomMapLegendFactory(
  LayerLegendHeader: ReturnType<typeof LayerLegendHeaderFactory>,
  LayerLegendContent: ReturnType<typeof LayerLegendContentFactory>,
) {
  const MapLegend: React.FC<MapLegendProps> = ({
    layers = [],
    width,
    isExport,
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
      <div
        className="map-legend border-border border"
        style={{width: containerW}}
      >
        <div className="relative flex flex-col">
          {!isExport && (
            <div className="border-muted bg-background sticky top-0 flex w-full items-center justify-between border-b p-2">
              <div className="text-xs font-medium">Map Layers</div>
              <Button
                variant="ghost"
                size="xs"
                className="h-6 w-6"
                onClick={handleClose}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex w-full flex-1 flex-col items-center">
            {layers
              .filter((layer) => layer.config.isVisible)
              .map((layer, index) => {
                return (
                  <LayerLegendItem
                    key={index}
                    layer={layer}
                    containerW={containerW}
                    isExport={isExport}
                    {...restProps}
                  />
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  const LayerLegendItem = ({
    layer,
    containerW,
    isExport,
    mapState,
    disableEdit,
    onLayerVisConfigChange,
  }: {layer: Layer; containerW: number} & MapLegendProps) => {
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
    const handleToggleVisibility = (
      evt: React.MouseEvent<HTMLButtonElement>,
    ) => {
      evt.stopPropagation();
      const nextVisible = !layer.config.isVisible;
      dispatchAction(mapId, layerConfigChange(layer, {isVisible: nextVisible}));
    };

    if (!layer.isValidToSave() || layer.config.hidden) {
      return null;
    }

    if (isExport && !layer.config.isVisible) {
      return null;
    }

    return (
      <div
        ref={containerRef}
        className="border-muted flex w-full flex-col items-center border-b"
      >
        <style>{`.legend--layer__item .panel--header__action { display: none !important; }`}</style>
        <div
          className="flex w-full flex-row items-center gap-2"
          onClick={handleToggleExpanded}
        >
          <div className="cursor-pointer items-center overflow-hidden p-2 text-xs text-ellipsis whitespace-nowrap select-none">
            {layer.config.label}
          </div>
          <div className="flex-1" />
          <div className="flex flex-row items-center justify-end gap-1">
            <Button
              className="h-7 w-7 hidden"
              variant="ghost"
              size="icon"
              onClick={handleToggleVisibility}
            >
              {layer.config.isVisible ? (
                <EyeIcon className="h-4 w-4" />
              ) : (
                <EyeOffIcon className="h-4 w-4" />
              )}
            </Button>
            <Button
              className="h-7 w-7"
              variant="ghost"
              size="icon"
              onClick={handleToggleExpanded}
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="w-full px-[8px] py-[5px] text-xs">
            <LayerLegendContent
              containerW={containerW}
              layer={layer}
              mapState={mapState}
              disableEdit={disableEdit}
              isExport={isExport}
              onLayerVisConfigChange={onLayerVisConfigChange}
              actionIcons={defaultActionIcons}
            />
          </div>
        )}
      </div>
    );
  };

  MapLegend.displayName = 'MapLegend';

  return MapLegend;
}
