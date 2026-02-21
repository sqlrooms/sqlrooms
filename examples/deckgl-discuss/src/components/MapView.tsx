import {
  MapboxOverlay as DeckOverlay,
  MapboxOverlayProps,
} from '@deck.gl/mapbox';
import {cn} from '@sqlrooms/ui';
import {GeoJsonLayer} from 'deck.gl';
import {MessageCircle, PlusCircle} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import {FC, useMemo, useState} from 'react';
import {Map, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {useRoomStore} from '../store';

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
  rootDiscussionText: string;
};

export const MapView: FC<{features: AirportFeature[] | undefined}> = ({
  features,
}) => {
  const [selected, setSelected] = useState<AirportFeature>();
  const [commentText, setCommentText] = useState('');

  // Get state from store
  const discussions = useRoomStore((state) => state.discuss.config.discussions);
  const addDiscussion = useRoomStore((state) => state.discuss.addDiscussion);
  const setReplyToItem = useRoomStore((state) => state.discuss.setReplyToItem);
  const setHighlightedDiscussionId = useRoomStore(
    (state) => state.discuss.setHighlightedDiscussionId,
  );
  const highlightedDiscussion = useRoomStore((state) =>
    state.discuss.config.discussions.find(
      (d) => d.id === state.discuss.highlightedDiscussionId,
    ),
  );

  // useEffect(() => {
  //   if (features) {
  //     setVi
  //   }
  // }, [features]);

  // Create a map of airport abbrev -> discussions
  const discussionsByAirport = useMemo(() => {
    // Group discussions by anchorId (which is the airport abbreviation)
    return discussions.reduce(
      (acc, discussion) => {
        if (discussion.anchorId) {
          if (!acc[discussion.anchorId]) {
            acc[discussion.anchorId] = [];
          }
          acc[discussion.anchorId].push(discussion);
        }
        return acc;
      },
      {} as Record<string, typeof discussions>,
    );
  }, [discussions]);

  // Create popup info for airports with discussions
  const airportsWithDiscussions = useMemo(() => {
    return features
      ? features
          .filter((feature) => discussionsByAirport[feature.properties.abbrev])
          .map((feature) => {
            const [longitude, latitude] = feature.geometry.coordinates;
            const airportDiscussions =
              discussionsByAirport[feature.properties.abbrev] || [];
            const firstDiscussion = airportDiscussions[0];
            return {
              featureId: feature.properties.abbrev,
              longitude,
              latitude,
              name: feature.properties.name,
              discussionCount: airportDiscussions.length,
              rootDiscussionText: firstDiscussion
                ? firstDiscussion.rootComment.text
                : '',
            } satisfies PopupInfo;
          })
      : [];
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

    // Get the comment text and reset input
    const text = commentText;
    setCommentText('');

    // Close the feature popup to avoid UI clutter
    setSelected(undefined);

    // Add a new discussion with the anchorId
    addDiscussion(text, anchorId);

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
      // Set the highlighted discussion ID
      setHighlightedDiscussionId(discussionWithAnchor.id);
    }
  };

  const layers = [
    new GeoJsonLayer({
      id: 'airports',
      data: features,
      filled: true,
      pointRadiusMinPixels: 2,
      pointRadiusScale: 4000,
      getPointRadius: (f) => 11 - (f.properties?.scalerank ?? 0),
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
            <div className="flex flex-col gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="w-full min-w-50 rounded border border-gray-300 p-2 text-sm"
                rows={2}
              />
              <button
                onClick={handleAddDiscussion}
                disabled={!commentText.trim()}
                className="mt-1 flex items-center justify-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600 disabled:bg-blue-300"
              >
                <PlusCircle size={14} />
                Add Comment
              </button>
            </div>
          </div>
        </Popup>
      )}

      {/* Annotation discussion popups */}
      {airportsWithDiscussions.map((airport) => (
        <Popup
          key={`discussion-${airport.featureId}`}
          anchor="bottom"
          longitude={airport.longitude}
          latitude={airport.latitude}
          closeOnClick={false}
          closeButton={false}
          className={cn(
            'z-10 text-black',
            '[&_.maplibregl-popup-close-button]:p-2 [&_.maplibregl-popup-content]:p-0',
            'cursor-pointer',
          )}
        >
          <div
            className={cn(
              'rounded bg-white p-2 transition-all duration-50 hover:bg-blue-200',
              highlightedDiscussion?.anchorId === airport.featureId &&
                'border-2 border-blue-500',
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDiscussions(airport.featureId);
            }}
          >
            <div className="text-sm font-medium">{airport.name}</div>
            {airport.rootDiscussionText && (
              <div className="mt-1 max-w-50 truncate text-sm text-gray-600">
                {airport.rootDiscussionText}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50">
              <MessageCircle size={14} />
              {airport.discussionCount}{' '}
              {airport.discussionCount === 1 ? 'Comment' : 'Comments'}
            </div>
          </div>
        </Popup>
      ))}

      <DeckGLOverlay layers={layers} interleaved />
      <NavigationControl position="top-left" />
    </Map>
  );
};
