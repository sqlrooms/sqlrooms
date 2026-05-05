import type {DeckGLRef} from '@deck.gl/react';
import type {RefObject} from 'react';
import {useEffect, useState} from 'react';
import {shallow} from 'zustand/shallow';

function useShallowStableArray<T extends readonly unknown[]>(value: T) {
  const [stableValue, setStableValue] = useState(value);

  if (!shallow(stableValue, value)) {
    setStableValue(value);
  }

  return stableValue;
}

/**
 * Schedule a post-layer redraw once meaningful layers are available, while
 * ignoring reference-only layer array churn. DeckGL still receives the latest
 * `layers` prop; the shallow-stable value is only for this effect dependency.
 */
export function useDeckLayersReadyRedraw({
  deckRef,
  hasRenderingError,
  layers,
}: {
  deckRef: RefObject<DeckGLRef | null>;
  hasRenderingError: boolean;
  layers: readonly unknown[];
}) {
  const stableLayers = useShallowStableArray(layers);

  useEffect(() => {
    if (hasRenderingError || stableLayers.length === 0) {
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        deckRef.current?.deck?.redraw('SQLRooms layers ready');
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [deckRef, hasRenderingError, stableLayers]);
}
