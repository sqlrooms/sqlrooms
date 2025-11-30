import {
  MapboxOverlay as DeckOverlay,
  MapboxOverlayProps,
} from '@deck.gl/mapbox';
import {GeoJsonLayer} from 'deck.gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {FC, useState} from 'react';
import {Map, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';

const INITIAL_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

export type AirportFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {name: string; abbrev: string; scalerank: number}
>;

export const MapView: FC<{features: AirportFeature[]}> = ({features}) => {
  const [selected, setSelected] = useState<AirportFeature>();

  // Handle clicking on an airport
  const handleAirportClick = (feature: AirportFeature) => {
    setSelected(feature);
  };

  const layers = [
    new GeoJsonLayer({
      id: 'airports',
      data: features,
      filled: true,
      pointRadiusMinPixels: 2,
      pointRadiusScale: 4000,
      getPointRadius: (f) => 11 - f.properties.scalerank,
      getFillColor: [200, 0, 80, 180],
      pickable: true,
      autoHighlight: true,
      onClick: (info) => handleAirportClick(info.object),
    }),
  ];

  return (
    <Map initialViewState={INITIAL_VIEW_STATE} mapStyle={MAP_STYLE}>
      {/* Selected airport popup */}
      {selected && (
        <Popup
          key={`selected-${selected.properties.abbrev}`}
          anchor="bottom"
          style={{zIndex: 10, color: '#000', minWidth: '100px'}}
          longitude={selected.geometry.coordinates[0]}
          latitude={selected.geometry.coordinates[1]}
          onClose={() => setSelected(undefined)}
          closeOnClick={false}
        >
          <div className="font-semibold">
            {selected.properties.name} ({selected.properties.abbrev})
          </div>
        </Popup>
      )}

      <DeckGLOverlay layers={layers} interleaved />
      <NavigationControl position="top-left" />
    </Map>
  );
};
