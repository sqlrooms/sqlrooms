import {JSONConverter} from '@deck.gl/json';
import {MapboxOverlay} from '@deck.gl/mapbox';
import {ColorScaleLegend} from '@sqlrooms/color-scales';
import {cn, ResolvedTheme, useTheme} from '@sqlrooms/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import {useEffect, useMemo, useRef, useState} from 'react';
import Map, {useControl} from 'react-map-gl/maplibre';
import {ZodError} from 'zod';
import {DeckJsonMapSpec} from './DeckJsonMapSpec';
import {normalizeDatasets} from './datasets/normalizeDatasets';
import {usePreparedDatasetStates} from './datasets/usePreparedDatasetStates';
import {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
import {extractColorScaleLegends} from './json/extractColorScaleLegends';
import {getLayerCompatibility} from './json/layerCompatibility';
import {resolveDatasetId} from './json/layerConfig';
import type {DeckJsonMapProps, PreparedDeckDatasetState} from './types';

const DEFAULT_MAP_STYLES: Record<ResolvedTheme, string> = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

function parseSpec(spec: DeckJsonMapProps['spec']) {
  try {
    const parsedValue = typeof spec === 'string' ? JSON.parse(spec) : spec;
    const validatedSpec = DeckJsonMapSpec.safeParse(parsedValue);
    if (!validatedSpec.success) {
      return {
        spec: null,
        error: new Error(formatSpecValidationError(validatedSpec.error)),
      };
    }

    return {
      spec: validatedSpec.data,
      error: null,
    };
  } catch (error) {
    return {
      spec: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function formatSpecValidationError(error: ZodError) {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'spec';
    return `${path}: ${issue.message}`;
  });

  return `Invalid DeckJsonMap spec. ${issues.join('; ')}`;
}

function extractFallbackDeckProps(spec: Record<string, unknown> | null) {
  if (!spec) {
    return {};
  }

  const fallbackProps: Record<string, unknown> = {};
  for (const key of ['initialViewState', 'viewState', 'controller']) {
    if (key in spec) {
      fallbackProps[key] = spec[key];
    }
  }

  return fallbackProps;
}

function filterUnavailableLayers(
  spec: Record<string, unknown>,
  datasetIds: string[],
  datasetStates: Record<string, PreparedDeckDatasetState>,
) {
  const layers = Array.isArray(spec.layers) ? spec.layers : [];
  const filteredLayers = layers.filter((layer) => {
    if (!layer || typeof layer !== 'object') {
      return true;
    }

    const layerProps = layer as Record<string, unknown>;
    const layerName = String(layerProps['@@type'] ?? '');
    const compatibility = getLayerCompatibility(layerName);
    if (!compatibility) {
      return true;
    }

    const datasetId = resolveDatasetId(layerProps, datasetIds);
    if (!datasetId) {
      return true;
    }

    const datasetState = datasetStates[datasetId];
    if (!datasetState) {
      return false;
    }

    return datasetState.status === 'ready';
  });

  return {
    ...spec,
    layers: filteredLayers,
  };
}

function renderDatasetErrorOverlay(
  datasetStates: Record<string, PreparedDeckDatasetState>,
) {
  const failedDatasets = Object.entries(datasetStates).filter(
    (
      entry,
    ): entry is [
      string,
      Extract<PreparedDeckDatasetState, {status: 'error'}>,
    ] => entry[1].status === 'error',
  );

  if (!failedDatasets.length) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 space-y-2">
      {failedDatasets.map(([datasetId, state]) => (
        <div
          key={datasetId}
          className="rounded-md border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-700 shadow-sm"
        >
          {`Dataset "${datasetId}" failed: ${state.error.message}`}
        </div>
      ))}
    </div>
  );
}

// Workaround for deck.gl HeatmapLayer not releasing its WebGL framebuffer
// when replaced by another layer type (e.g. switching heatmap → scatterplot).
// We detect layer class changes and clear layers for one animation frame,
// giving deck.gl a chance to finalize the old layer's resources before
// initializing the new one.
function DeckOverlayControl({
  interleaved,
  ...deckProps
}: {interleaved: boolean} & Record<string, unknown>) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({interleaved}),
  );
  const prevLayerKeyRef = useRef<string>('');
  const [clearing, setClearing] = useState(false);

  const layers = deckProps.layers as unknown[] | undefined;
  const layerKey = Array.isArray(layers)
    ? layers
        .map((l) => {
          if (!l || typeof l !== 'object') return '?';
          const ctor = (l as {constructor?: {name?: string}}).constructor;
          return ctor?.name ?? '?';
        })
        .join(',')
    : '';

  useEffect(() => {
    if (
      prevLayerKeyRef.current &&
      prevLayerKeyRef.current !== layerKey &&
      !clearing
    ) {
      setClearing(true);
    }
    prevLayerKeyRef.current = layerKey;
  }, [layerKey, clearing]);

  useEffect(() => {
    if (clearing) {
      overlay.setProps({...deckProps, layers: []});
      requestAnimationFrame(() => setClearing(false));
    }
  }, [clearing, deckProps, overlay]);

  if (!clearing) {
    overlay.setProps(deckProps);
  }

  return null;
}

export function DeckJsonMap({
  spec,
  datasets,
  mapStyle,
  interleaved = false,
  deckProps,
  mapProps,
  showLegends = true,
  className,
  children,
  onDatasetStatesChange,
}: DeckJsonMapProps) {
  const normalizedDatasets = useMemo(
    () => normalizeDatasets(datasets),
    [datasets],
  );
  const datasetIds = useMemo(
    () => Object.keys(normalizedDatasets),
    [normalizedDatasets],
  );
  const datasetStates = usePreparedDatasetStates(normalizedDatasets);
  const onDatasetStatesChangeRef = useRef(onDatasetStatesChange);

  const {spec: parsedSpec, error: specError} = useMemo(
    () => parseSpec(spec),
    [spec],
  );

  const availableSpec = useMemo(
    () =>
      parsedSpec
        ? filterUnavailableLayers(parsedSpec, datasetIds, datasetStates)
        : null,
    [parsedSpec, datasetIds, datasetStates],
  );

  const converter = useMemo(
    () =>
      new JSONConverter({
        configuration: createDeckJsonConfiguration({
          datasetStates,
          datasetIds,
        }),
        onJSONChange: () => {},
      }),
    [datasetIds, datasetStates],
  );

  const convertedDeckPropsResult = useMemo(() => {
    if (!availableSpec) {
      return {props: null, error: specError};
    }

    try {
      return {
        props: converter.convert(availableSpec) as Record<string, unknown>,
        error: null,
      };
    } catch (error) {
      return {
        props: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [availableSpec, converter, specError]);

  // Animation for TripsLayer — update currentTime on each frame
  const hasTripsLayer = useMemo(() => {
    if (!availableSpec || !Array.isArray(availableSpec.layers)) return false;
    return availableSpec.layers.some(
      (l: unknown) =>
        l &&
        typeof l === 'object' &&
        ((l as {'@@type'?: string})['@@type'] === 'GeoArrowTripsLayer' ||
          (l as {'@@type'?: string})['@@type'] === 'TripsLayer'),
    );
  }, [availableSpec]);

  const [tripsTime, setTripsTime] = useState(0);
  const tripsAnimRef = useRef<number>(0);
  useEffect(() => {
    if (!hasTripsLayer) return;
    const startTime = Date.now();
    let raf: number;
    const tick = () => {
      setTripsTime(Date.now() - startTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    tripsAnimRef.current = startTime;
    return () => cancelAnimationFrame(raf);
  }, [hasTripsLayer]);

  const finalDeckPropsResult = convertedDeckPropsResult;

  useEffect(() => {
    if (finalDeckPropsResult.error) {
      console.error(finalDeckPropsResult.error);
    }
  }, [finalDeckPropsResult.error]);

  useEffect(() => {
    onDatasetStatesChangeRef.current = onDatasetStatesChange;
  }, [onDatasetStatesChange]);

  useEffect(() => {
    onDatasetStatesChangeRef.current?.(datasetStates);
  }, [datasetStates]);

  const fallbackDeckProps = useMemo(
    () => extractFallbackDeckProps(availableSpec),
    [availableSpec],
  );
  const convertedDeckProps = (finalDeckPropsResult.props ??
    fallbackDeckProps ??
    {}) as Record<string, unknown>;
  const extraDeckProps = (deckProps ?? {}) as Record<string, unknown>;
  const extraMapProps = (mapProps ?? {}) as Record<string, unknown>;
  const hasRenderingError = Boolean(finalDeckPropsResult.error);
  const mergedLayers = hasRenderingError
    ? []
    : (deckProps?.layers ??
      (convertedDeckProps.layers as unknown[] | undefined) ??
      []);

  // Animate TripsLayer by injecting currentTime from the animation clock
  const animatedLayers = useMemo(() => {
    if (!hasTripsLayer || !Array.isArray(mergedLayers)) return mergedLayers;
    return mergedLayers.map((layer: unknown) => {
      if (!layer || typeof layer !== 'object') return layer;
      const layerObj = layer as {
        props?: Record<string, unknown>;
        clone?: (props: Record<string, unknown>) => unknown;
      };
      const maxTs = (layerObj.props as Record<string, unknown> | undefined)
        ?._tripsMaxTimestamp as number | undefined;
      if (maxTs && maxTs > 0 && layerObj.clone) {
        const loopLength = maxTs;
        const animationSpeed = 30;
        const currentTime = (tripsTime / animationSpeed) % loopLength;
        return layerObj.clone({
          currentTime,
          trailLength: loopLength * 0.4,
        });
      }
      return layer;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTripsLayer, mergedLayers, tripsTime]);

  const mergedDeckProps = {
    ...convertedDeckProps,
    ...extraDeckProps,
    layers: animatedLayers,
  };

  // overlayDeckProps should not contain viewState/initialViewState
  const {
    initialViewState,
    viewState: _viewState,
    ...overlayDeckProps
  } = mergedDeckProps as Record<string, unknown>;

  const {resolvedTheme} = useTheme();

  const mergedMapProps = {
    ...extraMapProps,
    mapStyle:
      mapStyle ?? mapProps?.mapStyle ?? DEFAULT_MAP_STYLES[resolvedTheme],
  };
  const legends = useMemo(
    () =>
      showLegends
        ? extractColorScaleLegends({
            spec: availableSpec,
            datasetIds,
            datasetStates,
          })
        : [],
    [availableSpec, datasetIds, datasetStates, showLegends],
  );

  return (
    <div className={cn('relative h-full w-full', className)}>
      {hasRenderingError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="max-w-sm rounded-md border border-red-200 bg-red-50/95 p-4 text-sm text-red-700 shadow-sm">
            {`Map couldn't be rendered. Check the console for details.`}
          </div>
        </div>
      ) : null}

      <Map
        {...(mergedMapProps as object)}
        {...(initialViewState
          ? {initialViewState: initialViewState as object}
          : {})}
        style={{width: '100%', height: '100%', ...mapProps?.style}}
      >
        <DeckOverlayControl interleaved={interleaved} {...overlayDeckProps} />
        {children}
      </Map>

      {renderDatasetErrorOverlay(datasetStates)}
      {!hasRenderingError && showLegends ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-56">
          <ColorScaleLegend legends={legends} />
        </div>
      ) : null}
    </div>
  );
}
