// SPDX-License-Identifier: MIT
// Copyright contributors to the kepler.gl project

import React, {useCallback} from 'react';
import {
  MapControlTooltipFactory,
  MapControlToolbarFactory,
  MapDrawPanelFactory,
} from '@kepler.gl/components';
import type {MapDrawPanelProps} from '@kepler.gl/components';
import {XIcon} from 'lucide-react';
import {Button} from '@sqlrooms/ui';

CustomMapDrawPanelFactory.deps = MapDrawPanelFactory.deps;

export function CustomMapDrawPanelFactory(
  MapControlTooltip: ReturnType<typeof MapControlTooltipFactory>,
  MapControlToolbar: ReturnType<typeof MapControlToolbarFactory>,
) {
  // Get the original MapDrawPanel component
  const OriginalMapDrawPanel = MapDrawPanelFactory(
    MapControlTooltip,
    MapControlToolbar,
  );

  const CustomMapDrawPanel: React.FC<MapDrawPanelProps> = React.memo(
    (props) => {
      const {mapControls, onToggleMapControl} = props;
      const isActive = mapControls?.mapDraw?.active;

      const onToggleMenuPanel = useCallback(
        () => onToggleMapControl('mapDraw'),
        [onToggleMapControl],
      );

      if (!mapControls?.mapDraw?.show) {
        return null;
      }

      return (
        <div className="map-draw-controls" style={{position: 'relative'}}>
          <OriginalMapDrawPanel {...props} />
          {isActive && (
            <Button
              variant="ghost"
              size="xs"
              className="border-border bg-background hover:bg-accent absolute z-50 h-6 w-6 rounded-full border p-0 shadow-sm"
              style={{left: '-35px', top: '-20px'}}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleMenuPanel();
              }}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    },
  );

  CustomMapDrawPanel.displayName = 'CustomMapDrawPanel';
  return CustomMapDrawPanel;
}
