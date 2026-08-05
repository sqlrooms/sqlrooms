import {useEffect, useRef, type ReactNode} from 'react';
import {MapView} from '../lab/map-view';
import type {HoverBrush} from '../hooks/use-hover-brush';

type MapPaneProps = {
  cube: Float32Array;
  brush: HoverBrush;
  onMap: (map: MapView | null) => void;
};

export function MapShell({children}: {children?: ReactNode}) {
  return (
    <div className="map-pane">
      {children}
      <div className="map-title">
        <strong>ECMWF IFS ENS - temperature</strong>
      </div>
      <div className="map-legend">
        <span>-10 °C</span>
        <div className="legend-ramp" />
        <span>30 °C</span>
      </div>
    </div>
  );
}

export function LoadingOverlay({message}: {message: string}) {
  return (
    <div className="map-loading" role="status" aria-live="polite">
      <div className="loader-panel">
        <span className="spinner" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

/**
 * Hosts the imperative deck.gl view (ZarrLayer raster plus brush ring). The
 * MapView class owns the WebGL lifecycle; React only mounts and unmounts it
 * and lays the brush capture overlay on top while the hover brush is armed.
 */
export function MapPane({cube, brush, onMap}: MapPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new MapView(containerRef.current!, cube);
    onMap(map);
    return () => {
      onMap(null);
      map.finalize();
    };
  }, [cube, onMap]);

  return (
    <MapShell>
      <div id="map" ref={containerRef} />
      {brush.enabled && (
        <div
          className="map-brush-overlay"
          onPointerMove={(event) => {
            brush.onPointerMove(event.clientX, event.clientY);
            event.preventDefault();
          }}
        />
      )}
    </MapShell>
  );
}
