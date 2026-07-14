/**
 * Non-visual controller that strips the Cesium scene down to a clean dark
 * background: no stars, sun, moon, or atmospheric glow. We want the focus to
 * be on the seismicity and slab geometry, not a pretty space scene.
 */

import {useEffect} from 'react';
import {Color} from 'cesium';
import {useStoreWithCesium} from './cesium';

export function SceneStyleController() {
  const viewer = useStoreWithCesium((s) => s.cesium.viewer);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const scene = viewer.scene;

    // Cesium's TS types don't expose `show` on these scene objects even
    // though it's a documented runtime field on SkyBox/Sun/Moon/SkyAtmosphere.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    if (scene.skyBox) (scene.skyBox as any).show = false;
    if (scene.sun) (scene.sun as any).show = false;
    if (scene.moon) (scene.moon as any).show = false;
    if (scene.skyAtmosphere) (scene.skyAtmosphere as any).show = false;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    scene.backgroundColor = Color.BLACK;
  }, [viewer]);

  return null;
}
