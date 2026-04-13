/**
 * Component that renders a Cesium 3D Tileset layer (e.g. OSM Buildings).
 * Supports both Ion asset IDs and direct tileset URLs.
 */

import {useEffect, useRef} from 'react';
import {
  Cesium3DTileset,
  IonResource,
  type Viewer as CesiumViewer,
} from 'cesium';
import type {CesiumLayerConfig} from '../cesium-config';
import {useStoreWithCesium} from '../cesium-slice';

export interface CesiumTilesetLayerProps {
  layerConfig: CesiumLayerConfig;
}

export const CesiumTilesetLayer: React.FC<CesiumTilesetLayerProps> = ({
  layerConfig,
}) => {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let cancelled = false;

    void loadTileset(viewer, layerConfig, cancelled).then((tileset) => {
      if (cancelled || !tileset) return;
      tilesetRef.current = tileset;
    });

    return () => {
      cancelled = true;
      removeTileset(viewer, tilesetRef.current);
      tilesetRef.current = null;
    };
  }, [viewer, layerConfig.id, layerConfig.ionAssetId, layerConfig.tilesetUrl]);

  useEffect(() => {
    if (tilesetRef.current && !tilesetRef.current.isDestroyed()) {
      tilesetRef.current.show = layerConfig.visible;
    }
  }, [layerConfig.visible]);

  return null;
};

async function loadTileset(
  viewer: CesiumViewer,
  config: CesiumLayerConfig,
  cancelled: boolean,
): Promise<Cesium3DTileset | null> {
  try {
    let tileset: Cesium3DTileset;

    if (config.ionAssetId != null) {
      const resource = await IonResource.fromAssetId(config.ionAssetId);
      if (cancelled) return null;
      tileset = await Cesium3DTileset.fromUrl(resource);
    } else if (config.tilesetUrl) {
      tileset = await Cesium3DTileset.fromUrl(config.tilesetUrl);
    } else {
      return null;
    }

    if (cancelled) {
      tileset.destroy();
      return null;
    }

    tileset.show = config.visible;
    viewer.scene.primitives.add(tileset);
    return tileset;
  } catch (err) {
    console.error(`Failed to load tileset layer "${config.id}":`, err);
    return null;
  }
}

function removeTileset(
  viewer: CesiumViewer,
  tileset: Cesium3DTileset | null,
): void {
  if (!tileset || tileset.isDestroyed()) return;
  if (!viewer.isDestroyed()) {
    viewer.scene.primitives.remove(tileset);
  }
}
