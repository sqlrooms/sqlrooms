import {JSONConverter} from '@deck.gl/json';
import DeckGL from '@deck.gl/react';
import {ColorScaleLegend} from '@sqlrooms/color-scales';
import {cn, ResolvedTheme, useTheme} from '@sqlrooms/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import {useEffect, useMemo} from 'react';
import Map from 'react-map-gl/maplibre';
import {ZodError} from 'zod';
import {DeckJsonMapSpec} from './DeckSpec';
import {normalizeDatasets} from './datasets/normalizeDatasets';
import {usePreparedDeckDatasets} from './datasets/usePreparedDeckDatasets';
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

function renderDatasetStatusOverlay(
  datasetStates: Record<string, PreparedDeckDatasetState>,
) {
  const loadingDatasets = Object.entries(datasetStates)
    .filter(([, state]) => state.status === 'loading')
    .map(([datasetId]) => datasetId);
  const failedDatasets = Object.entries(datasetStates).filter(
    (
      entry,
    ): entry is [
      string,
      Extract<PreparedDeckDatasetState, {status: 'error'}>,
    ] => entry[1].status === 'error',
  );

  if (!loadingDatasets.length && !failedDatasets.length) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 space-y-2">
      {loadingDatasets.length > 0 ? (
        <div className="rounded-md border border-black/10 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm">
          Loading datasets: {loadingDatasets.join(', ')}
        </div>
      ) : null}
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

export function DeckJsonMap({
  spec,
  datasets,
  sqlQuery,
  arrowTable,
  queryResult,
  geometryColumn,
  geometryEncodingHint,
  mapStyle,
  deckProps,
  mapProps,
  showLegends = true,
  className,
  children,
}: DeckJsonMapProps) {
  const normalizedDatasets = useMemo(
    () =>
      normalizeDatasets({
        datasets,
        sqlQuery,
        arrowTable,
        queryResult,
        geometryColumn,
        geometryEncodingHint,
      }),
    [
      datasets,
      sqlQuery,
      arrowTable,
      queryResult,
      geometryColumn,
      geometryEncodingHint,
    ],
  );
  const datasetIds = useMemo(
    () => Object.keys(normalizedDatasets),
    [normalizedDatasets],
  );
  const datasetStates = usePreparedDeckDatasets(normalizedDatasets);

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

  useEffect(() => {
    if (convertedDeckPropsResult.error) {
      console.error(convertedDeckPropsResult.error);
    }
  }, [convertedDeckPropsResult.error]);

  const fallbackDeckProps = useMemo(
    () => extractFallbackDeckProps(availableSpec),
    [availableSpec],
  );
  const convertedDeckProps = (convertedDeckPropsResult.props ??
    fallbackDeckProps ??
    {}) as Record<string, unknown>;
  const extraDeckProps = (deckProps ?? {}) as Record<string, unknown>;
  const extraMapProps = (mapProps ?? {}) as Record<string, unknown>;
  const hasRenderingError = Boolean(convertedDeckPropsResult.error);

  const mergedDeckProps = {
    ...convertedDeckProps,
    ...extraDeckProps,
    layers: hasRenderingError
      ? []
      : (deckProps?.layers ??
        (convertedDeckProps.layers as unknown[] | undefined) ??
        []),
  };

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

      <DeckGL {...(mergedDeckProps as object)}>
        <Map {...(mergedMapProps as object)}>{children}</Map>
      </DeckGL>

      {renderDatasetStatusOverlay(datasetStates)}
      {!hasRenderingError && showLegends ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-56">
          <ColorScaleLegend legends={legends} />
        </div>
      ) : null}
    </div>
  );
}
