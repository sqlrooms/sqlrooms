import {Layer} from '@deck.gl/core';
import {
  MapboxOverlay as DeckOverlay,
  MapboxOverlayProps,
} from '@deck.gl/mapbox';
import {FlowmapLayer} from '@flowmap.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import {FC, useMemo} from 'react';
import {Map, NavigationControl, useControl} from 'react-map-gl/maplibre';
import * as arrow from 'apache-arrow';
import {cn} from '@sqlrooms/ui';

const INITIAL_VIEW_STATE = {
  latitude: 45.50884,
  longitude: -73.58781,
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

export type Location = {
  id: number;
  name: string;
  lat: number;
  lon: number;
};

export type Flow = {origin: number; dest: number; count: number};

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

export const FlowmapView: FC<{
  className?: string;
  locations: arrow.Table | undefined;
  flows: arrow.Table | undefined;
}> = ({className, locations, flows}) => {
  const data = useMemo(() => {
    if (!locations || !flows) return null;
    const result = {
      locations: locations.toArray(),
      flows: flows.toArray(),
    };
    return result;
  }, [locations, flows]);

  const layers: Layer[] = [];
  if (data) {
    layers.push(
      new FlowmapLayer({
        id: 'my-flowmap-layer',
        data,
        darkMode: false,
        pickable: true,
        getLocationId: (loc: Location) => loc.id,
        getLocationName: (loc: Location) => loc.name,
        getLocationLat: (loc: Location) => loc.lat,
        getLocationLon: (loc: Location) => loc.lon,
        getFlowOriginId: (flow: Flow) => flow.origin,
        getFlowDestId: (flow: Flow) => flow.dest,
        getFlowMagnitude: (flow: Flow) => flow.count,
        // onHover: (info) => setTooltip(getTooltipState(info)),
        // onClick: (info) => console.log('clicked', info.type, info.object),
      }) as Layer,
    );
  }
  return (
    <div className={cn('relative h-full w-full', className)}>
      <style>
        {`.maplibregl-control-container {
          mix-blend-mode: darken;
        }`}
      </style>
      <Map initialViewState={INITIAL_VIEW_STATE} mapStyle={MAP_STYLE}>
        <DeckGLOverlay layers={layers} />
        <NavigationControl position="top-left" />
      </Map>
    </div>
  );
};
