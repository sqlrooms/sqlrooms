import {
  MapboxOverlay as DeckOverlay,
  MapboxOverlayProps,
} from '@deck.gl/mapbox';
import {GeoJsonLayer} from 'deck.gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {FC, useState, useEffect, useMemo} from 'react';
import {Map, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {useProjectStore} from '../store';
import {PlusCircle, MessageCircle} from 'lucide-react';
import {createId} from '@paralleldrive/cuid2';

const INITIAL_VIEW_STATE = {
  latitude: 51.47,
  longitude: 0.45,
  zoom: 4,
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

type PopupInfo = {
  featureId: string;
  longitude: number;
  latitude: number;
  name: string;
  discussionCount: number;
};

export const MapView: FC<{features: AirportFeature[]}> = ({features}) => {
  const [selected, setSelected] = useState<AirportFeature>();

  // Get state from store
  const discussions = useProjectStore((state) => state.discussion.discussions);
  const addDiscussion = useProjectStore(
    (state) => state.discussion.addDiscussion,
  );
  const setReplyToItem = useProjectStore(
    (state) => state.discussion.setReplyToItem,
  );

  // Create a map of airport abbrev -> discussion counts
  const discussionsByAirport = useMemo(() => {
    // Group discussions by anchorId (which is the airport abbreviation)
    return discussions.reduce(
      (acc, discussion) => {
        if (discussion.anchorId) {
          acc[discussion.anchorId] = (acc[discussion.anchorId] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [discussions]);

  // Create popup info for airports with discussions
  const airportsWithDiscussions = useMemo(() => {
    return features
      .filter((feature) => discussionsByAirport[feature.properties.abbrev])
      .map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        return {
          featureId: feature.properties.abbrev,
          longitude,
          latitude,
          name: feature.properties.name,
          discussionCount: discussionsByAirport[feature.properties.abbrev] || 0,
        } satisfies PopupInfo;
      });
  }, [features, discussionsByAirport]);

  // Handle clicking on an airport
  const handleAirportClick = (feature: AirportFeature) => {
    setSelected(feature);
  };

  // Start a new discussion for the selected airport
  const handleAddDiscussion = () => {
    if (!selected) return;

    // Use the airport abbrev as the anchorId
    const anchorId = selected.properties.abbrev;

    // Close the feature popup to avoid UI clutter
    setSelected(undefined);

    // Add a new discussion with the anchorId
    addDiscussion('', anchorId);

    // Set UI to reply to the new discussion
    setTimeout(() => {
      const discussionWithAnchor = discussions.find(
        (d) => d.anchorId === anchorId,
      );
      if (discussionWithAnchor) {
        setReplyToItem({
          discussionId: discussionWithAnchor.id,
        });
      }
    }, 10);
  };

  // Open the discussion panel for an existing annotation
  const handleViewDiscussions = (airportId: string) => {
    // Find first discussion with this anchorId
    const discussionWithAnchor = discussions.find(
      (d) => d.anchorId === airportId,
    );
    if (discussionWithAnchor) {
      setReplyToItem({
        discussionId: discussionWithAnchor.id,
      });
    }
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
          style={{zIndex: 10, color: '#000'}}
          longitude={selected.geometry.coordinates[0]}
          latitude={selected.geometry.coordinates[1]}
          onClose={() => setSelected(undefined)}
          closeOnClick={false}
        >
          <div className="px-1 py-2">
            <div className="font-semibold">{selected.properties.name}</div>
            <div className="mb-2 text-sm text-gray-600">
              {selected.properties.abbrev}
            </div>
            <button
              onClick={handleAddDiscussion}
              className="mt-1 flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600"
            >
              <PlusCircle size={14} />
              Comment
            </button>
          </div>
        </Popup>
      )}

      {/* Annotation discussion popups */}
      {airportsWithDiscussions.map((airport) => (
        <Popup
          key={`discussion-${airport.featureId}`}
          anchor="bottom"
          style={{zIndex: 5, color: '#000'}}
          longitude={airport.longitude}
          latitude={airport.latitude}
          closeOnClick={false}
          closeButton={false}
        >
          <div className="text-sm font-medium">{airport.name}</div>
          <button
            onClick={() => handleViewDiscussions(airport.featureId)}
            className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
          >
            <MessageCircle size={14} />
            {airport.discussionCount}{' '}
            {airport.discussionCount === 1 ? 'Comment' : 'Comments'}
          </button>
        </Popup>
      ))}

      <DeckGLOverlay layers={layers} />
      <NavigationControl position="top-left" />
    </Map>
  );
};
