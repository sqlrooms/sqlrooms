import {useCellsStore} from '@sqlrooms/cells';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {VgPlotChart} from '@sqlrooms/mosaic';
import type {Spec} from '@sqlrooms/mosaic';
import {Button, SpinnerPane} from '@sqlrooms/ui';
import {AlertCircle, SparklesIcon} from 'lucide-react';
import React from 'react';
import {DEFAULT_DASHBOARD_VGPLOT_SPEC, useRoomStore} from '../store';

const VGPLOT_SCHEMA_URL = 'https://idl.uw.edu/mosaic/schema/latest.json';

let vgplotSchemaCache: Record<string, unknown> | null = null;
let vgplotSchemaPromise: Promise<Record<string, unknown>> | null = null;

type ParsedVgplotSpec = {
  parsed: Spec | null;
  formatted: string | null;
  error: string | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseVgplotSpec(value: string): ParsedVgplotSpec {
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
        error: 'Vgplot spec must be a JSON object.',
      };
    }
    return {
      parsed: parsed as Spec,
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

async function loadVgplotSchema(): Promise<Record<string, unknown>> {
  if (vgplotSchemaCache) {
    return vgplotSchemaCache;
  }
  if (!vgplotSchemaPromise) {
    vgplotSchemaPromise = fetch(VGPLOT_SCHEMA_URL)
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
        vgplotSchemaCache = data as Record<string, unknown>;
        return vgplotSchemaCache;
      })
      .catch((error) => {
        vgplotSchemaPromise = null;
        throw error;
      });
  }
  return vgplotSchemaPromise;
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
  const setSheetVgplot = useRoomStore(
    (state) => state.dashboard.setSheetVgplot,
  );
  const setAssistantOpen = useRoomStore((state) => state.setAssistantOpen);
  const mosaicConnection = useRoomStore((state) => state.mosaic.connection);

  const persistedSpec = dashboardEntry?.vgplot ?? DEFAULT_DASHBOARD_VGPLOT_SPEC;

  const [editorValue, setEditorValue] = React.useState<string>(persistedSpec);
  const [lastAppliedValue, setLastAppliedValue] =
    React.useState<string>(persistedSpec);
  const [schema, setSchema] = React.useState<
    Record<string, unknown> | undefined
  >(vgplotSchemaCache ?? undefined);
  const [schemaError, setSchemaError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentSheetId) return;
    ensureSheetDashboard(currentSheetId);
  }, [currentSheetId, ensureSheetDashboard]);

  React.useEffect(() => {
    setEditorValue(persistedSpec);
    setLastAppliedValue(persistedSpec);
  }, [currentSheetId, persistedSpec]);

  React.useEffect(() => {
    if (schema) return;
    let cancelled = false;
    void loadVgplotSchema()
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
  }, [schema]);

  const parsedEditorSpec = React.useMemo(
    () => parseVgplotSpec(editorValue),
    [editorValue],
  );
  const parsedAppliedSpec = React.useMemo(
    () => parseVgplotSpec(lastAppliedValue),
    [lastAppliedValue],
  );
  const previewSpec = parsedEditorSpec.parsed ?? parsedAppliedSpec.parsed;
  const previewError = parsedEditorSpec.error;
  const isDirty = editorValue !== lastAppliedValue;
  const canApply = Boolean(
    currentSheetId && parsedEditorSpec.formatted && isDirty,
  );

  const applyChanges = React.useCallback(() => {
    if (!currentSheetId || !parsedEditorSpec.formatted) return;
    setSheetVgplot(currentSheetId, parsedEditorSpec.formatted);
    setLastAppliedValue(parsedEditorSpec.formatted);
    setEditorValue(parsedEditorSpec.formatted);
  }, [currentSheetId, parsedEditorSpec.formatted, setSheetVgplot]);

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
            (previewSpec ? (
              <VgPlotChart spec={previewSpec} />
            ) : (
              <div className="text-muted-foreground text-sm">
                No valid dashboard spec to preview yet.
              </div>
            ))}
        </div>
      </div>
      {previewError && (
        <div className="bg-destructive/90 text-destructive-foreground flex items-center gap-2 px-3 py-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{previewError}</span>
        </div>
      )}
    </div>
  );
};
