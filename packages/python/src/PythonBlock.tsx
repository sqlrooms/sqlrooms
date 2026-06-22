import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {acceptCompletion} from '@codemirror/autocomplete';
import {indentLess, indentMore} from '@codemirror/commands';
import {python} from '@codemirror/lang-python';
import {Prec} from '@codemirror/state';
import {keymap} from '@codemirror/view';
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
import {PYTHON_BLOCK_TYPE} from './PythonBlockCommands';
import type {PythonSliceState} from './PythonSlice';
import type {
  PythonInput,
  PythonOutputDeclaration,
  PythonResultSummary,
  PythonExecutionOutput,
} from './types';
import {useStoreWithPython} from './useStoreWithPython';

export type PythonBlockRenderProps<
  TRoomState extends PythonSliceState = PythonSliceState,
> = StatefulBlockRenderProps<TRoomState> & {
  artifactId?: string;
  compact?: boolean;
  className?: string;
};

export type PythonBlockProps = PythonBlockRenderProps;

export const PythonBlock: FC<PythonBlockProps> = ({
  blockId,
  title,
  readOnly,
  artifactId,
  compact,
  className,
}) => {
  const pythonBlock = useStoreWithPython((state) =>
    blockId ? state.python.config.blocks[blockId] : undefined,
  );
  const runtime = useStoreWithPython((state) =>
    blockId ? state.python.runtimeByBlockId[blockId] : undefined,
  );
  const ensureBlock = useStoreWithPython((state) => state.python.ensureBlock);
  const updateBlockCode = useStoreWithPython(
    (state) => state.python.updateBlockCode,
  );
  const runBlock = useStoreWithPython((state) => state.python.runBlock);
  const clearBlockResult = useStoreWithPython(
    (state) => state.python.clearBlockResult,
  );

  useEffect(() => {
    if (!blockId) return;
    ensureBlock(blockId, title === undefined ? {} : {title});
  }, [blockId, ensureBlock, title]);

  const handleCodeChange = useCallback(
    (code: string) => {
      if (!blockId || readOnly) return;
      updateBlockCode(blockId, code);
    },
    [blockId, readOnly, updateBlockCode],
  );

  const handleRun = useCallback(() => {
    if (!blockId || readOnly || runtime?.status === 'running') return;
    void runBlock(blockId, {artifactId});
  }, [artifactId, blockId, readOnly, runBlock, runtime?.status]);

  const editorExtensions = useMemo(
    () => [
      python(),
      createSqlroomsTheme(),
      Prec.high(
        keymap.of([
          {
            key: 'Tab',
            run: (view) => {
              if (acceptCompletion(view)) return true;
              return indentMore(view);
            },
          },
          {
            key: 'Shift-Tab',
            run: indentLess,
          },
          {
            key: 'Mod-Enter',
            run: () => {
              handleRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [handleRun],
  );

  const handleClear = useCallback(() => {
    if (!blockId || readOnly) return;
    clearBlockResult(blockId);
  }, [blockId, clearBlockResult, readOnly]);

  if (!blockId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Python block is missing a block id.
      </div>
    );
  }

  const isRunning = runtime?.status === 'running';
  const result = pythonBlock?.lastResult;

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
            {pythonBlock?.title ?? title ?? 'Python'}
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
                disabled={readOnly || isRunning || !pythonBlock?.code.trim()}
                onClick={handleRun}
                aria-label="Run Python"
              >
                <PlayIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run Python</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={readOnly || isRunning || !result}
                onClick={handleClear}
                aria-label="Clear Python result"
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
        value={pythonBlock?.code ?? ''}
        readOnly={readOnly}
        onChange={handleCodeChange}
        extensions={editorExtensions}
        options={{
          lineNumbers: true,
          lineWrapping: true,
          foldGutter: false,
          autocompletion: true,
        }}
      />
      <PythonDeclarations
        inputs={pythonBlock?.inputs ?? []}
        outputs={pythonBlock?.outputs ?? []}
      />
      <PythonResultPanel isRunning={isRunning} result={result} />
    </section>
  );
};

export type CreatePythonBlockDefinitionOptions<
  TRoomState extends PythonSliceState = PythonSliceState,
> = {
  render?: ComponentType<PythonBlockRenderProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
};

/** Creates the embeddable stateful block definition for Python blocks. */
export function createPythonBlockDefinition<
  TRoomState extends PythonSliceState = PythonSliceState,
>({
  render = PythonBlock as ComponentType<PythonBlockRenderProps<TRoomState>>,
  label = 'Python',
  defaultTitle = 'Python',
}: CreatePythonBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: PYTHON_BLOCK_TYPE,
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
      getState().python.ensureBlock(blockId, {
        title: title ?? defaultTitle,
      });
    },
    rename: ({blockId, title, getState}) => {
      getState().python.renameBlock(blockId, title);
    },
    deleteState: ({blockId, getState}) => {
      getState().python.removeBlock(blockId);
    },
  };
}

const ResultStatusBadge: FC<{
  isRunning: boolean;
  result?: PythonResultSummary;
}> = ({isRunning, result}) => {
  if (isRunning) return <Badge variant="secondary">Running</Badge>;
  if (!result) return <Badge variant="outline">Idle</Badge>;
  if (result.status === 'success') return <Badge>Success</Badge>;
  return <Badge variant="destructive">{result.status}</Badge>;
};

const PythonDeclarations: FC<{
  inputs: PythonInput[];
  outputs: PythonOutputDeclaration[];
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

const PythonResultPanel: FC<{
  isRunning: boolean;
  result?: PythonResultSummary;
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
    case 'html':
      return <HtmlOutputFrame label={output.name} html={output.html} />;
    case 'vega-lite':
      return <VegaLiteOutputFrame label={output.name} spec={output.spec} />;
  }
};

const HtmlOutputFrame: FC<{label: string; html: string}> = ({label, html}) => (
  <div>
    <div className="text-muted-foreground mb-1 text-xs font-medium">
      {label}
    </div>
    <iframe
      title={`Python HTML output: ${label}`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="bg-background h-96 w-full rounded-sm border"
      srcDoc={html}
    />
  </div>
);

const VegaLiteOutputFrame: FC<{
  label: string;
  spec: Record<string, unknown>;
}> = ({label, spec}) => (
  <HtmlOutputFrame label={label} html={createVegaLiteOutputHtml(spec)} />
);

function createVegaLiteOutputHtml(spec: Record<string, unknown>) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src https: data: blob:;"
    />
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: transparent;
        color: CanvasText;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #vis {
        box-sizing: border-box;
        min-height: 360px;
        padding: 12px;
      }
      #error {
        color: #b91c1c;
        font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div id="vis"></div>
    <pre id="error" hidden></pre>
    <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
    <script>
      const spec = ${JSON.stringify(spec).replace(/</g, '\\u003c')};
      vegaEmbed("#vis", spec, {
        actions: false,
        renderer: "svg",
        tooltip: true
      }).catch((error) => {
        const errorElement = document.getElementById("error");
        errorElement.hidden = false;
        errorElement.textContent = error && error.stack ? error.stack : String(error);
      });
    </script>
  </body>
</html>`;
}

function runtimeLabel(isRunning: boolean, result?: PythonResultSummary) {
  if (isRunning) return 'Execution in progress';
  if (!result) return 'Local Python runtime adapter pending';
  if (result.status === 'success') {
    return result.durationMs === undefined
      ? 'Last run succeeded'
      : `Last run succeeded in ${Math.round(result.durationMs)} ms`;
  }
  return result.error?.message ?? `Last run finished with ${result.status}`;
}
