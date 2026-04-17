/**
 * Small status overlay that bridges the gap between "data source finished
 * downloading" (covered by <RoomShell.LoadingProgress />) and "earthquake
 * entities are actually on the globe".
 *
 * Once the parquet is loaded into DuckDB, there's still several seconds of
 * work before anything renders: DuckDB runs the layer SQL, the results get
 * turned into ~17k entity descriptors, and Resium walks the tree adding
 * each one to Cesium's entity collection. Without this overlay the user
 * sees an empty globe and assumes the app is broken.
 *
 * Hidden as soon as the viewer's entity count is non-zero.
 */

import {useEffect, useState} from 'react';
import {Spinner} from '@sqlrooms/ui';
import {useStoreWithCesium} from '@sqlrooms/cesium';
import {useRoomStore} from './store';
import {EARTHQUAKE_LAYER_ID} from './earthquake-slice';

export function RenderingStatus() {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const tableName = useRoomStore(
    (s) =>
      s.cesium.config.layers.find((l) => l.id === EARTHQUAKE_LAYER_ID)
        ?.tableName ?? null,
  );
  const tableReady = useStoreWithCesium((s) =>
    tableName ? Boolean(s.db.findTableByName(tableName)) : false,
  );
  const [entityCount, setEntityCount] = useState(0);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const sync = () => {
      if (!viewer.isDestroyed()) {
        setEntityCount(viewer.entities.values.length);
      }
    };
    sync();
    viewer.entities.collectionChanged.addEventListener(sync);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.entities.collectionChanged.removeEventListener(sync);
      }
    };
  }, [viewer]);

  // The room-shell progress bar covers the parquet download. We only want
  // to show up in the "table ready but no entities yet" window.
  const isRendering = tableReady && entityCount === 0;
  if (!isRendering) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-black/70 px-6 py-4 text-white backdrop-blur-sm">
        <Spinner className="text-white" />
        <div className="text-sm">Rendering earthquakes…</div>
      </div>
    </div>
  );
}
