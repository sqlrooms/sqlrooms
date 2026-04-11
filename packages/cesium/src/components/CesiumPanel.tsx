/**
 * Main panel component for Cesium 3D globe visualization.
 * Registered with the SQLRooms layout system.
 */

import React from 'react';
import {CesiumViewerWrapper} from './CesiumViewerWrapper';
import {CesiumToolbar} from './CesiumToolbar';
import {CesiumClock} from './CesiumClock';

/**
 * Top-level panel component registered with SQLRooms layout.
 * Combines the Cesium viewer with control overlays.
 *
 * **Usage**: Register this component in the room store's layout.panels config:
 *
 * @example
 * ```typescript
 * import {CesiumPanel} from '@sqlrooms/cesium';
 * import {GlobeIcon} from 'lucide-react';
 *
 * layout: {
 *   panels: {
 *     'cesium-globe': {
 *       title: '3D Globe',
 *       icon: GlobeIcon,
 *       component: CesiumPanel,
 *       placement: 'main',
 *     },
 *   },
 * }
 * ```
 */
export const CesiumPanel: React.FC = () => {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Cesium viewer fills entire panel */}
      <CesiumViewerWrapper />

      {/* Control overlays positioned absolutely */}
      <CesiumToolbar className="absolute top-2 right-2 z-10" />
      <CesiumClock className="absolute bottom-4 left-4 z-10" />
    </div>
  );
};
