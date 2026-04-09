import type {FC} from 'react';
import {useEffect} from 'react';
import {cn} from '@sqlrooms/ui';
import {useStoreWithAi} from '../../AiSlice';
import {MessageContainer} from '../MessageContainer';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';
import {ToolErrorMessage} from './ToolErrorMessage';

type ToolResultProps = {
  toolCallId: string;
  toolName: string;
  output: unknown;
  input: unknown;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
  errorText?: string;
  isExcludedFromGrouping?: boolean;
};

export const ToolResult: FC<ToolResultProps> = ({
  toolCallId,
  toolName,
  output,
  input,
  state,
  errorText,
  isExcludedFromGrouping = false,
}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  // Look up directly from the registry object (stable reference) to avoid
  // the react-hooks/static-components lint rule flagging a function call.
  const ToolComponent = toolName ? toolRenderers[toolName] : undefined;

  const args = (input ?? {}) as Record<string, unknown>;

  // check if args has a property called 'reasoning'
  const reason = args.reasoning as string | undefined;

  const isCompleted = state === 'output-available' || state === 'output-error';

  // Determine success: non-object outputs (strings, numbers) are always treated
  // as success. Object outputs are success unless they explicitly set `success: false`.
  // This is lenient by design — tools that don't follow the `{success: boolean}`
  // convention still render their result component.
  const isSuccess =
    state === 'output-available' &&
    output != null &&
    (typeof output !== 'object' ||
      (output as Record<string, unknown>).success !== false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      isCompleted &&
      isSuccess &&
      toolName &&
      !ToolComponent
    ) {
      console.warn(
        `[ai-core] Tool "${toolName}" completed with output but has no registered renderer. ` +
          `Register one via createAiSlice({ toolRenderers: { ${toolName}: MyRenderer } }).`,
      );
    }
  }, [isCompleted, isSuccess, toolName, ToolComponent]);

  return !isCompleted ? (
    <div
      className={cn(
        'text-sm',
        isExcludedFromGrouping ? 'text-foreground' : 'text-gray-500',
      )}
    >
      {reason ?? ''}
    </div>
  ) : (
    <MessageContainer
      isSuccess={isSuccess}
      type={toolName}
      content={{
        toolName,
        args,
        output,
        isCompleted,
      }}
    >
      <div
        className={cn(
          'text-sm',
          isExcludedFromGrouping ? 'text-foreground' : 'text-gray-500',
        )}
      >
        {reason && <span>{reason}</span>}
        {isCompleted && (errorText || !isSuccess) && (
          <ToolErrorMessage
            error={errorText ?? 'Tool call failed'}
            details={{toolName, input, output, state}}
            title="Tool call error"
            triggerLabel="Tool call failed"
            editorHeightPx={300}
          />
        )}
      </div>
      {ToolComponent && isSuccess && isCompleted && (
        <ToolCallErrorBoundary>
          {typeof ToolComponent === 'function' ? (
            <ToolComponent
              output={output}
              input={input}
              toolCallId={toolCallId}
              state={state}
              errorText={errorText}
            />
          ) : (
            ToolComponent
          )}
        </ToolCallErrorBoundary>
      )}
    </MessageContainer>
  );
};
