import {useCellsStore} from '@sqlrooms/cells';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import type {Spec} from '@sqlrooms/mosaic';
import {astToDOM, parseSpec, VgPlotChart} from '@sqlrooms/mosaic';
import {Button, SpinnerPane} from '@sqlrooms/ui';
import {AlertCircle, SparklesIcon} from 'lucide-react';
import React from 'react';
import {DEFAULT_DASHBOARD_VGPLOT_SPEC, useRoomStore} from '../store';
import {getErrorMessage} from '../utils';

const VGPLOT_SCHEMA_URL = 'https://idl.uw.edu/mosaic/schema/latest.json';

type VgPlotSchemaCache = {
  data: Record<string, unknown> | null;
  promise: Promise<Record<string, unknown>> | null;
};

type ParsedVgPlotSpec = {
  parsed: Spec | null;
  formatted: string | null;
  error: string | null;
};

function toRenderableMosaicSpec(
  parsedValue: Record<string, unknown>,
): Record<string, unknown> {
  const mosaicSpec = {...parsedValue};
  if ('$schema' in mosaicSpec) {
    delete mosaicSpec.$schema;
  }
  return mosaicSpec;
}

function parseVgPlotSpec(value: string): ParsedVgPlotSpec {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        parsed: null,
        formatted: null,
        error: 'VgPlot spec must be a JSON object.',
      };
    }
    return {
      parsed: toRenderableMosaicSpec(
        parsed as Record<string, unknown>,
      ) as unknown as Spec,
      formatted: JSON.stringify(parsed, null, 2),
      error: null,
    };
  } catch (error) {
    return {
      parsed: null,
      formatted: null,
      error: getErrorMessage(error),
    };
  }
}

async function loadVgPlotSchema(
  cache: VgPlotSchemaCache,
): Promise<Record<string, unknown>> {
  if (cache.data) {
    return cache.data;
  }
  if (!cache.promise) {
    cache.promise = fetch(VGPLOT_SCHEMA_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load vgplot schema (${response.status} ${response.statusText}).`,
          );
        }
        const data = (await response.json()) as unknown;
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          throw new Error('Received an invalid vgplot schema document.');
        }
        cache.data = data as Record<string, unknown>;
        return cache.data;
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }
  return cache.promise;
}

export const DashboardSheet: React.FC = () => {
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const dashboardEntry = useRoomStore((state) =>
    currentSheetId
      ? state.dashboard.config.dashboardsBySheetId[currentSheetId]
      : undefined,
  );
  const ensureSheetDashboard = useRoomStore(
    (state) => state.dashboard.ensureSheetDashboard,
  );
  const setSheetVgPlot = useRoomStore(
    (state) => state.dashboard.setSheetVgPlot,
  );
  const setAssistantOpen = useRoomStore((state) => state.setAssistantOpen);
  const mosaicConnection = useRoomStore((state) => state.mosaic.connection);

  const schemaCacheRef = React.useRef<VgPlotSchemaCache>({
    data: null,
    promise: null,
  });

  const persistedSpec = dashboardEntry?.vgplot ?? DEFAULT_DASHBOARD_VGPLOT_SPEC;

  const [editorValue, setEditorValue] = React.useState<string>(persistedSpec);
  const [lastAppliedValue, setLastAppliedValue] =
    React.useState<string>(persistedSpec);
  const [schema, setSchema] = React.useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [schemaError, setSchemaError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentSheetId) return;
    ensureSheetDashboard(currentSheetId);
  }, [currentSheetId, ensureSheetDashboard]);

  const prevSheetIdRef = React.useRef(currentSheetId);
  React.useEffect(() => {
    const sheetChanged = currentSheetId !== prevSheetIdRef.current;
    prevSheetIdRef.current = currentSheetId;

    if (sheetChanged) {
      setEditorValue(persistedSpec);
      setLastAppliedValue(persistedSpec);
    } else {
      setLastAppliedValue((prev) => {
        if (prev === persistedSpec) return prev;
        setEditorValue((editorVal) =>
          editorVal === prev ? persistedSpec : editorVal,
        );
        return persistedSpec;
      });
    }
  }, [currentSheetId, persistedSpec]);

  React.useEffect(() => {
    let cancelled = false;
    void loadVgPlotSchema(schemaCacheRef.current)
      .then((loadedSchema) => {
        if (!cancelled) {
          setSchema(loadedSchema);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSchemaError(getErrorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedEditorSpec = React.useMemo(
    () => parseVgPlotSpec(editorValue),
    [editorValue],
  );
  const parsedAppliedSpec = React.useMemo(
    () => parseVgPlotSpec(lastAppliedValue),
    [lastAppliedValue],
  );
  const previewSpec = parsedEditorSpec.parsed ?? parsedAppliedSpec.parsed;
  const previewError = parsedEditorSpec.error;
  const isDirty = editorValue !== lastAppliedValue;
  const canApply = Boolean(
    currentSheetId && parsedEditorSpec.formatted && isDirty,
  );
  const [compiledPlot, setCompiledPlot] = React.useState<
    HTMLElement | SVGSVGElement | null
  >(null);
  const [isCompilingPlot, setIsCompilingPlot] = React.useState(false);
  const [plotCompileError, setPlotCompileError] = React.useState<string | null>(
    null,
  );

  const applyChanges = React.useCallback(() => {
    if (!currentSheetId || !parsedEditorSpec.formatted) return;
    setSheetVgPlot(currentSheetId, parsedEditorSpec.formatted);
    setLastAppliedValue(parsedEditorSpec.formatted);
    setEditorValue(parsedEditorSpec.formatted);
  }, [currentSheetId, parsedEditorSpec.formatted, setSheetVgPlot]);

  React.useEffect(() => {
    if (mosaicConnection.status !== 'ready' || !previewSpec) {
      setCompiledPlot(null);
      setPlotCompileError(null);
      setIsCompilingPlot(false);
      return;
    }
    let cancelled = false;
    const DEBOUNCE_MS = 300;
    const timer = setTimeout(() => {
      setIsCompilingPlot(true);
      setPlotCompileError(null);
      void (async () => {
        try {
          const ast = await parseSpec(previewSpec);
          const instantiated = await astToDOM(ast);
          if (cancelled) return;
          setCompiledPlot(instantiated.element);
        } catch (error) {
          if (cancelled) return;
          setCompiledPlot(null);
          setPlotCompileError(getErrorMessage(error));
        } finally {
          if (!cancelled) {
            setIsCompilingPlot(false);
          }
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mosaicConnection.status, previewSpec]);

  if (!currentSheetId) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Dashboard</h3>
            <p className="text-muted-foreground text-xs">
              Edit vgplot JSON and preview with Mosaic.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssistantOpen(true)}
            >
              <SparklesIcon className="mr-1 h-4 w-4" />
              Ask assistant
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!isDirty}
              onClick={() => setEditorValue(lastAppliedValue)}
            >
              Reset
            </Button>
            <Button size="sm" disabled={!canApply} onClick={applyChanges}>
              Apply
            </Button>
          </div>
        </div>
        {schemaError && (
          <p className="text-destructive mt-2 text-xs">
            Schema completion unavailable: {schemaError}
          </p>
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div className="min-h-0 border-r">
          <JsonMonacoEditor
            className="h-full"
            value={editorValue}
            schema={schema}
            onChange={(value) => setEditorValue(value ?? '')}
            options={{
              lineNumbers: 'on',
              minimap: {enabled: false},
              wordWrap: 'on',
            }}
          />
        </div>
        <div className="min-h-0 overflow-auto p-3">
          {mosaicConnection.status === 'loading' && (
            <SpinnerPane className="h-full w-full" />
          )}
          {mosaicConnection.status === 'error' && (
            <div className="text-destructive text-sm">
              Mosaic connection failed:{' '}
              {getErrorMessage(mosaicConnection.error)}
            </div>
          )}
          {mosaicConnection.status === 'ready' &&
            (isCompilingPlot ? (
              <SpinnerPane className="h-full w-full" />
            ) : compiledPlot ? (
              <div className="inline-block min-w-full rounded-md border bg-white p-2 text-black">
                <VgPlotChart plot={compiledPlot} />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                {plotCompileError
                  ? 'Unable to render dashboard from the current vgplot spec.'
                  : 'No valid dashboard spec to preview yet.'}
              </div>
            ))}
        </div>
      </div>
      {(previewError || plotCompileError) && (
        <div className="bg-destructive/90 text-destructive-foreground flex items-center gap-2 px-3 py-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{previewError ?? plotCompileError}</span>
        </div>
      )}
    </div>
  );
};
