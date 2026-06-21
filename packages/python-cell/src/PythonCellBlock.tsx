import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@sqlrooms/ui';
import {EraserIcon, FileCode2Icon, PlayIcon} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  type ComponentType,
  type FC,
} from 'react';
import {PYTHON_CELL_BLOCK_TYPE} from './PythonCellCommands';
import type {PythonCellSliceState} from './PythonCellSlice';
import type {
  PythonCellInput,
  PythonCellOutputDeclaration,
  PythonCellResultSummary,
  PythonExecutionOutput,
} from './types';
import {useStoreWithPythonCells} from './useStoreWithPythonCells';

export type PythonCellBlockRenderProps<
  TRoomState extends PythonCellSliceState = PythonCellSliceState,
> = StatefulBlockRenderProps<TRoomState> & {
  artifactId?: string;
  compact?: boolean;
  className?: string;
};

export type PythonCellBlockProps = PythonCellBlockRenderProps;

export const PythonCellBlock: FC<PythonCellBlockProps> = ({
  blockId,
  title,
  readOnly,
  artifactId,
  compact,
  className,
}) => {
  const cell = useStoreWithPythonCells((state) =>
    blockId ? state.pythonCells.config.cells[blockId] : undefined,
  );
  const runtime = useStoreWithPythonCells((state) =>
    blockId ? state.pythonCells.runtimeByCellId[blockId] : undefined,
  );
  const ensureCell = useStoreWithPythonCells(
    (state) => state.pythonCells.ensureCell,
  );
  const updateCellCode = useStoreWithPythonCells(
    (state) => state.pythonCells.updateCellCode,
  );
  const runCell = useStoreWithPythonCells((state) => state.pythonCells.runCell);
  const clearCellResult = useStoreWithPythonCells(
    (state) => state.pythonCells.clearCellResult,
  );
  const editorExtensions = useMemo(() => [createSqlroomsTheme()], []);

  useEffect(() => {
    if (!blockId) return;
    ensureCell(blockId, {title: title ?? 'Python Cell'});
  }, [blockId, ensureCell, title]);

  const handleCodeChange = useCallback(
    (code: string) => {
      if (!blockId || readOnly) return;
      updateCellCode(blockId, code);
    },
    [blockId, readOnly, updateCellCode],
  );

  const handleRun = useCallback(() => {
    if (!blockId || runtime?.status === 'running') return;
    void runCell(blockId, {artifactId});
  }, [artifactId, blockId, runCell, runtime?.status]);

  const handleClear = useCallback(() => {
    if (!blockId || readOnly) return;
    clearCellResult(blockId);
  }, [blockId, clearCellResult, readOnly]);

  if (!blockId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Python cell block is missing a cell id.
      </div>
    );
  }

  const isRunning = runtime?.status === 'running';
  const result = cell?.lastResult;

  return (
    <section
      className={cn(
        'border-border bg-background overflow-hidden rounded-md border',
        className,
      )}
    >
      <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
        <FileCode2Icon className="text-muted-foreground h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {cell?.title ?? title ?? 'Python Cell'}
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {runtimeLabel(isRunning, result)}
          </div>
        </div>
        <ResultStatusBadge isRunning={isRunning} result={result} />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 shrink-0"
                disabled={isRunning || !cell?.code.trim()}
                onClick={handleRun}
                aria-label="Run Python cell"
              >
                <PlayIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run Python cell</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={readOnly || isRunning || !result}
                onClick={handleClear}
                aria-label="Clear Python cell result"
              >
                <EraserIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear result</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <CodeMirrorEditor
        className={cn(
          'h-auto min-h-[160px] border-0 [&_.cm-editor]:min-h-[160px]',
          compact ? 'min-h-[120px] [&_.cm-editor]:min-h-[120px]' : undefined,
        )}
        value={cell?.code ?? ''}
        readOnly={readOnly}
        onChange={handleCodeChange}
        extensions={editorExtensions}
        options={{
          lineNumbers: true,
          lineWrapping: true,
          foldGutter: false,
          autocompletion: false,
        }}
      />
      <CellDeclarations
        inputs={cell?.inputs ?? []}
        outputs={cell?.outputs ?? []}
      />
      <PythonCellResultPanel isRunning={isRunning} result={result} />
    </section>
  );
};

export type CreatePythonCellBlockDefinitionOptions<
  TRoomState extends PythonCellSliceState = PythonCellSliceState,
> = {
  render?: ComponentType<PythonCellBlockRenderProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
};

/** Creates the embeddable stateful block definition for Python cells. */
export function createPythonCellBlockDefinition<
  TRoomState extends PythonCellSliceState = PythonCellSliceState,
>({
  render = PythonCellBlock as ComponentType<
    PythonCellBlockRenderProps<TRoomState>
  >,
  label = 'Python Cell',
  defaultTitle = 'Python Cell',
}: CreatePythonCellBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: PYTHON_CELL_BLOCK_TYPE,
    label,
    defaultTitle,
    icon: FileCode2Icon,
    capabilities: {
      stateful: true,
      embeddable: true,
      executable: true,
      producesRelation: true,
      consumesRelation: true,
      hasRuntimeCache: true,
    },
    render,
    ensureState: ({blockId, title, getState}) => {
      getState().pythonCells.ensureCell(blockId, {
        title: title ?? defaultTitle,
      });
    },
    rename: ({blockId, title, getState}) => {
      getState().pythonCells.renameCell(blockId, title);
    },
    deleteState: ({blockId, getState}) => {
      getState().pythonCells.removeCell(blockId);
    },
  };
}

const ResultStatusBadge: FC<{
  isRunning: boolean;
  result?: PythonCellResultSummary;
}> = ({isRunning, result}) => {
  if (isRunning) return <Badge variant="secondary">Running</Badge>;
  if (!result) return <Badge variant="outline">Idle</Badge>;
  if (result.status === 'success') return <Badge>Success</Badge>;
  return <Badge variant="destructive">{result.status}</Badge>;
};

const CellDeclarations: FC<{
  inputs: PythonCellInput[];
  outputs: PythonCellOutputDeclaration[];
}> = ({inputs, outputs}) => {
  if (inputs.length === 0 && outputs.length === 0) return null;
  return (
    <div className="border-border bg-muted/20 flex flex-wrap gap-2 border-t px-3 py-2 text-xs">
      {inputs.map((input) => (
        <Badge key={`input:${input.name}`} variant="outline">
          input {input.name}: {input.kind}
        </Badge>
      ))}
      {outputs.map((output) => (
        <Badge key={`output:${output.name}`} variant="outline">
          output {output.name}: {output.type}
        </Badge>
      ))}
    </div>
  );
};

const PythonCellResultPanel: FC<{
  isRunning: boolean;
  result?: PythonCellResultSummary;
}> = ({isRunning, result}) => {
  if (isRunning) {
    return (
      <div className="border-border text-muted-foreground border-t px-3 py-3 text-sm">
        Running Python...
      </div>
    );
  }
  if (!result) {
    return (
      <div className="border-border text-muted-foreground border-t px-3 py-3 text-sm">
        No result yet.
      </div>
    );
  }
  return (
    <div className="border-border space-y-3 border-t px-3 py-3 text-sm">
      {result.error ? (
        <pre className="bg-destructive/10 text-destructive overflow-auto rounded-sm p-2 text-xs whitespace-pre-wrap">
          {result.error.traceback || result.error.message}
        </pre>
      ) : null}
      {result.stdout ? (
        <ResultPre label="stdout" value={result.stdout} />
      ) : null}
      {result.stderr ? (
        <ResultPre label="stderr" value={result.stderr} muted />
      ) : null}
      {result.outputs.length ? (
        <div className="space-y-2">
          {result.outputs.map((output) => (
            <ExecutionOutputView
              key={`${output.type}:${output.name}`}
              output={output}
            />
          ))}
        </div>
      ) : result.error ? null : (
        <div className="text-muted-foreground">
          Execution produced no outputs.
        </div>
      )}
    </div>
  );
};

const ResultPre: FC<{label: string; value: string; muted?: boolean}> = ({
  label,
  value,
  muted,
}) => (
  <div>
    <div className="text-muted-foreground mb-1 text-xs font-medium">
      {label}
    </div>
    <pre
      className={cn(
        'bg-muted overflow-auto rounded-sm p-2 text-xs whitespace-pre-wrap',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {value}
    </pre>
  </div>
);

const ExecutionOutputView: FC<{output: PythonExecutionOutput}> = ({output}) => {
  switch (output.type) {
    case 'text':
      return <ResultPre label={output.name} value={output.text} />;
    case 'markdown':
      return <ResultPre label={output.name} value={output.markdown} />;
    case 'table':
      return (
        <div className="bg-muted rounded-sm p-2 text-xs">
          <span className="font-medium">{output.name}</span>: {output.tableName}
          {output.rowCount === undefined ? '' : ` (${output.rowCount} rows)`}
        </div>
      );
    case 'image':
      return (
        <div className="bg-muted rounded-sm p-2 text-xs">
          <span className="font-medium">{output.name}</span>: image asset{' '}
          {output.assetId}
        </div>
      );
    case 'json':
      return (
        <ResultPre
          label={output.name}
          value={JSON.stringify(output.preview ?? output.value, null, 2)}
        />
      );
  }
};

function runtimeLabel(isRunning: boolean, result?: PythonCellResultSummary) {
  if (isRunning) return 'Execution in progress';
  if (!result) return 'Local Python runtime adapter pending';
  if (result.status === 'success') {
    return result.durationMs === undefined
      ? 'Last run succeeded'
      : `Last run succeeded in ${Math.round(result.durationMs)} ms`;
  }
  return result.error?.message ?? `Last run finished with ${result.status}`;
}
