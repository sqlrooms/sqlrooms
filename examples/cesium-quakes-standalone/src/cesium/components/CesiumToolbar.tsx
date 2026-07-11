/**
 * Camera and layer control toolbar for Cesium viewer.
 */

import React from 'react';
import {Maximize2, Eye, EyeOff} from 'lucide-react';
import {Button} from '@sqlrooms/ui';
import {useStoreWithCesium} from '../cesium-slice';
import {cn} from '@sqlrooms/ui';

export interface CesiumToolbarProps {
  className?: string;
}

/**
 * Toolbar with camera controls and layer visibility toggles.
 * Positioned as an overlay on the Cesium viewer.
 *
 * @example
 * ```typescript
 * <div className="relative h-full w-full">
 *   <CesiumViewerWrapper />
 *   <CesiumToolbar className="absolute right-2 top-2 z-10" />
 * </div>
 * ```
 */
export const CesiumToolbar: React.FC<CesiumToolbarProps> = ({className}) => {
  const zoomToFit = useStoreWithCesium((s) => s.cesium.zoomToFit);
  const layers = useStoreWithCesium((s) => s.cesium.config.layers);
  const toggleLayerVisibility = useStoreWithCesium(
    (s) => s.cesium.toggleLayerVisibility,
  );

  return (
    <div
      className={cn(
        'bg-background/80 flex flex-col gap-2 rounded-lg p-2 shadow-lg backdrop-blur',
        className,
      )}
    >
      {/* Camera controls */}
      <Button
        onClick={zoomToFit}
        variant="outline"
        size="sm"
        title="Fit view to all entities"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>

      {/* Layer visibility toggles */}
      {layers.length > 0 && (
        <>
          <div className="border-border my-1 border-t" />
          {layers.map((layer) => (
            <Button
              key={layer.id}
              onClick={() => toggleLayerVisibility(layer.id)}
              variant={layer.visible ? 'default' : 'outline'}
              size="sm"
              title={`${layer.visible ? 'Hide' : 'Show'} ${layer.id}`}
            >
              {layer.visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          ))}
        </>
      )}
    </div>
  );
};
