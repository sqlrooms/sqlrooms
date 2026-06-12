import {JSONConverter} from '@deck.gl/json';
import {MapboxOverlay} from '@deck.gl/mapbox';
import {ColorScaleLegend} from '@sqlrooms/color-scales';
import {cn, ResolvedTheme, useTheme} from '@sqlrooms/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import {forwardRef} from 'react';
import Map, {useControl} from 'react-map-gl/maplibre';
import {ZodError} from 'zod';
import {DeckJsonMapSpec} from './DeckJsonMapSpec';
import {normalizeDatasets} from './datasets/normalizeDatasets';
import {usePreparedDatasetStates} from './datasets/usePreparedDatasetStates';
import {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
import {extractColorScaleLegends} from './json/extractColorScaleLegends';
import {getLayerCompatibility} from './json/layerCompatibility';
import {resolveDatasetId} from './json/layerConfig';
import type {
  DeckJsonMapHandle,
  DeckJsonMapProps,
  PreparedDeckDatasetState,
} from './types';

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

const TripsTimeControl: FC<{
  currentTime: number;
  maxTime: number;
  playing: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}> = ({currentTime, maxTime, playing, onPlayPause, onSeek}) => {
  const [collapsed, setCollapsed] = useState(false);
  const progress = maxTime > 0 ? currentTime / maxTime : 0;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="border-border/70 bg-background/90 text-muted-foreground hover:text-foreground pointer-events-auto flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[10px] leading-none font-medium shadow-sm backdrop-blur-sm transition-colors"
      >
        Timeline
      </button>
    );
  }

  return (
    <div className="bg-background/90 border-border/70 pointer-events-auto relative flex items-center gap-1.5 rounded-md border px-2 py-1.5 pr-7 shadow-sm backdrop-blur-sm">
      <button
        onClick={onPlayPause}
        className="text-foreground hover:bg-accent flex h-5 w-5 shrink-0 items-center justify-center rounded"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="1" y="1" width="3" height="8" />
            <rect x="6" y="1" width="3" height="8" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="2,1 9,5 2,9" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        onChange={(e) => onSeek((Number(e.target.value) / 1000) * maxTime)}
        className="h-1 w-24 flex-1 cursor-pointer"
      />
      <button
        onClick={() => setCollapsed(true)}
        className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-sm transition-colors"
        title="Collapse"
      >
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path
            d="M1 1L7 7M7 1L1 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};

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
    if (clearing && overlay) {
      overlay.setProps({layers: []});
      requestAnimationFrame(() => setClearing(false));
    }
  }, [clearing, overlay]);

  if (!clearing && overlay) {
    overlay.setProps(deckProps);
  }

  return null;
}

export const DeckJsonMap = forwardRef<DeckJsonMapHandle, DeckJsonMapProps>(
  function DeckJsonMap(
    {
      spec,
      datasets,
      mapStyle,
      interleaved = true,
      deckProps,
      mapProps,
      showLegends = true,
      className,
      children,
      onDatasetStatesChange,
    },
    ref,
  ) {
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
    const [tripsPlaying, setTripsPlaying] = useState(true);
    const tripsTimeRef = useRef(0);

    useEffect(() => {
      if (!hasTripsLayer || !tripsPlaying) return;
      let raf: number;
      let lastFrame = Date.now();
      const tick = () => {
        const now = Date.now();
        tripsTimeRef.current += now - lastFrame;
        lastFrame = now;
        setTripsTime(tripsTimeRef.current);
        raf = requestAnimationFrame(tick);
      };
      lastFrame = Date.now();
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [hasTripsLayer, tripsPlaying]);

    const handleTripsPlayPause = useCallback(() => {
      setTripsPlaying((p) => !p);
    }, []);

    const handleTripsSeek = useCallback((time: number) => {
      const rawTime = time * 30;
      tripsTimeRef.current = rawTime;
      setTripsTime(rawTime);
    }, []);

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

    // Separate stable layer analysis from per-frame animation to avoid
    // re-running .map() over all layers 60 times per second.
    const baseLayers = useMemo(() => {
      const mergedLayers = hasRenderingError
        ? []
        : (deckProps?.layers ??
          (convertedDeckProps.layers as unknown[] | undefined) ??
          []);
      if (!hasTripsLayer || !Array.isArray(mergedLayers))
        return {layers: mergedLayers, maxTs: 0, tripsIndices: [] as number[]};
      let computedMaxTs = 0;
      const tripsIndices: number[] = [];
      for (let i = 0; i < mergedLayers.length; i++) {
        const layer = mergedLayers[i];
        if (!layer || typeof layer !== 'object') continue;
        const layerObj = layer as {props?: Record<string, unknown>};
        const maxTs = (layerObj.props as Record<string, unknown> | undefined)
          ?._tripsMaxTimestamp as number | undefined;
        if (maxTs && maxTs > 0) {
          computedMaxTs = maxTs;
          tripsIndices.push(i);
        }
      }
      return {layers: mergedLayers, maxTs: computedMaxTs, tripsIndices};
    }, [
      hasTripsLayer,
      hasRenderingError,
      deckProps?.layers,
      convertedDeckProps.layers,
    ]);

    // Per-frame: only clone trips layers with updated currentTime
    const animatedLayers = useMemo(() => {
      const {layers, tripsIndices} = baseLayers;
      if (!tripsIndices.length) return layers;
      if (!Array.isArray(layers)) return layers;
      const result = layers.slice();
      for (const idx of tripsIndices) {
        const layer = result[idx];
        if (!layer || typeof layer !== 'object') continue;
        const layerObj = layer as {
          props?: Record<string, unknown>;
          clone?: (props: Record<string, unknown>) => unknown;
        };
        if (!layerObj.clone) continue;
        const props = layerObj.props as Record<string, unknown> | undefined;
        const maxTs = (props?._tripsMaxTimestamp as number | undefined) ?? 0;
        const trailFraction =
          (props?.trailLengthFraction as number | undefined) ?? 0.4;
        const widthPx = (props?.widthMinPixels as number | undefined) ?? 3;
        const animationSpeed = 30;
        const currentTime = (tripsTime / animationSpeed) % maxTs;
        result[idx] = layerObj.clone({
          currentTime,
          trailLength: maxTs * trailFraction,
          widthMinPixels: widthPx,
        });
      }
      return result;
    }, [baseLayers, tripsTime]);
    const tripsMaxTimeValue = baseLayers.maxTs;

    const tripsCurrentTime = useMemo(() => {
      if (!tripsMaxTimeValue || tripsMaxTimeValue <= 0) return 0;
      return (tripsTime / 30) % tripsMaxTimeValue;
    }, [tripsTime, tripsMaxTimeValue]);

    const mergedDeckProps = {
      ...convertedDeckProps,
      ...extraDeckProps,
      layers: animatedLayers,
    };

    // overlayDeckProps should not contain viewState/initialViewState
    const {
      initialViewState,
      viewState: _vs,
      onViewStateChange: _onViewStateChange,
      ...overlayDeckProps
    } = mergedDeckProps as Record<string, unknown>;
    void _vs;
    void _onViewStateChange;

    const mapRef = useRef<{jumpTo: (opts: object) => void} | null>(null);
    const pendingJumpRef = useRef<object | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        jumpTo(opts) {
          const jumpOpts = {
            center: [opts.longitude, opts.latitude] as [number, number],
            zoom: opts.zoom,
            bearing: opts.bearing ?? 0,
            pitch: opts.pitch ?? 0,
          };
          if (mapRef.current) {
            mapRef.current.jumpTo(jumpOpts);
          } else {
            pendingJumpRef.current = jumpOpts;
          }
        },
      }),
      [],
    );

    const handleMapLoad = useCallback(() => {
      if (pendingJumpRef.current && mapRef.current) {
        mapRef.current.jumpTo(pendingJumpRef.current);
        pendingJumpRef.current = null;
      }
    }, []);

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
          ref={mapRef as any}
          {...(mergedMapProps as object)}
          {...(initialViewState
            ? {initialViewState: initialViewState as object}
            : {})}
          onLoad={handleMapLoad}
          style={{width: '100%', height: '100%', ...mapProps?.style}}
        >
          <DeckOverlayControl interleaved={interleaved} {...overlayDeckProps} />
          {children}
        </Map>

        {renderDatasetErrorOverlay(datasetStates)}
        {!hasRenderingError && showLegends ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-56">
            {hasTripsLayer && tripsMaxTimeValue > 0 ? (
              <div className="mb-1">
                <TripsTimeControl
                  currentTime={tripsCurrentTime}
                  maxTime={tripsMaxTimeValue}
                  playing={tripsPlaying}
                  onPlayPause={handleTripsPlayPause}
                  onSeek={handleTripsSeek}
                />
              </div>
            ) : null}
            <ColorScaleLegend legends={legends} />
          </div>
        ) : hasTripsLayer && tripsMaxTimeValue > 0 ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10">
            <TripsTimeControl
              currentTime={tripsCurrentTime}
              maxTime={tripsMaxTimeValue}
              playing={tripsPlaying}
              onPlayPause={handleTripsPlayPause}
              onSeek={handleTripsSeek}
            />
          </div>
        ) : null}
      </div>
    );
  },
);
