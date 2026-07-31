import {
  Button,
  CopyButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {SplitIcon, SquareTerminalIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithAi} from '../AiSlice';
import {TOOL_CALL_CANCELLED} from '../constants';
import {isReasoningPart, isTextPart} from '../utils';
import {ActivityBox} from './ActivityBox';
import {
  type ChatActionsProps,
  type ChatActivityProps,
  type ChatHoistedOutputProps,
  type ChatPromptProps,
  type ChatReasoningProps,
  type ChatRenderingComponents,
  type ChatTextOutputProps,
  type ChatToolActivityProps,
  type ChatTurnSlotProps,
} from './ChatRenderingContext';
import {HighlightedChatSearchText} from './ChatSearch';
import {ErrorMessage} from './ErrorMessage';
import {ExpandableContent} from './ExpandableContent';
import {
  HoistedToolCallRenderer,
  OrchestratorToolLogLine,
} from './FlatAgentRenderer';
import {MessageContent} from './MessageContent';
import {ToolPartRenderer} from './ToolPartRenderer';
import {getToolName} from './buildChatTurnModel';
import {toolRendererAllowsHoist} from './collectHoistableRenderers';

export const DefaultChatPrompt: React.FC<ChatPromptProps> = ({
  prompt,
  searchBlockId,
}) => (
  <div className="group/prompt bg-muted flex w-full items-start gap-2 rounded-md border p-2 text-sm">
    <SquareTerminalIcon className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1">
      <ExpandableContent maxHeight={60} showLabels={false}>
        <div className="break-words">
          <HighlightedChatSearchText blockId={searchBlockId} text={prompt} />
        </div>
      </ExpandableContent>
    </div>
    <div className="shrink-0 opacity-0 transition-opacity group-focus-within/prompt:opacity-100 group-hover/prompt:opacity-100">
      <CopyButton
        text={prompt}
        className="relative top-[2px] h-4 w-6"
        tooltipLabel="Copy prompt"
      />
    </div>
  </div>
);

/**
 * SQLRooms default activity chrome: collapsible summary + capped scroll box.
 * Product-specific wording/chrome belongs in app recipes.
 */
export const DefaultChatActivity: React.FC<ChatActivityProps> = ({
  children,
  isRunning,
  summaryLabel,
  className,
}) => (
  <ActivityBox
    isRunning={isRunning}
    summaryLabel={summaryLabel}
    className={className}
  >
    {children}
  </ActivityBox>
);

export const DefaultChatReasoning: React.FC<ChatReasoningProps> = ({
  text,
  isRunning,
  searchBlockId,
}) => (
  <details className="border-border bg-muted/30 text-muted-foreground group rounded-md border text-xs">
    <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-2 px-3 py-2 font-medium select-none">
      <span>{isRunning ? 'Thinking...' : 'Thinking'}</span>
      <span className="text-muted-foreground/70 text-[11px] font-normal group-open:hidden">
        show
      </span>
      <span className="text-muted-foreground/70 hidden text-[11px] font-normal group-open:inline">
        hide
      </span>
    </summary>
    <div className="border-border/70 max-h-64 overflow-auto border-t px-3 py-2 leading-relaxed whitespace-pre-wrap">
      <HighlightedChatSearchText blockId={searchBlockId} text={text} />
    </div>
  </details>
);

export const DefaultChatTextOutput: React.FC<ChatTextOutputProps> = ({
  text,
  isAnswer,
  searchBlockId,
  customMarkdownComponents,
}) => (
  <MessageContent
    content={text}
    isAnswer={isAnswer}
    searchBlockId={searchBlockId}
    customMarkdownComponents={customMarkdownComponents}
  />
);

export const DefaultChatToolActivity: React.FC<ChatToolActivityProps> = ({
  part,
  isAgent,
  isHoisted,
  searchBlockId,
}) => {
  if (isAgent) {
    return <ToolPartRenderer part={part} toolCallId={part.toolCallId} />;
  }

  return (
    <>
      <OrchestratorToolLogLine
        part={part}
        toolCallId={part.toolCallId}
        searchBlockId={searchBlockId}
      />
      {!isHoisted && (
        <ToolPartRenderer
          part={part}
          toolCallId={part.toolCallId}
          hideToolCallInfo
        />
      )}
    </>
  );
};

export const DefaultChatHoistedOutput: React.FC<ChatHoistedOutputProps> = ({
  item,
}) => <HoistedToolCallRenderer item={item} />;

export const DefaultChatActions: React.FC<ChatActionsProps> = ({
  hasTextContent,
  allTextContent,
  canFork,
  onFork,
  errorMessage,
  ErrorMessageComponent,
}) => (
  <>
    {errorMessage &&
      !errorMessage.startsWith(TOOL_CALL_CANCELLED) &&
      (ErrorMessageComponent ? (
        <ErrorMessageComponent errorMessage={errorMessage} />
      ) : (
        <ErrorMessage errorMessage={errorMessage} />
      ))}
    {(hasTextContent || canFork) && (
      <div className="flex justify-start gap-1">
        {hasTextContent && (
          <CopyButton
            text={allTextContent}
            tooltipLabel="Copy message"
            className="border-muted border"
          />
        )}
        {canFork && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="border-muted text-muted-foreground hover:text-foreground h-8 w-8 border"
                aria-label="Fork chat from this message"
                onClick={onFork}
              >
                <SplitIcon className="h-4 w-4 rotate-90" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fork</TooltipContent>
          </Tooltip>
        )}
      </div>
    )}
  </>
);

function isPartHoisted(
  part: ChatToolActivityProps['part'],
  hoistableToolNames: ReadonlySet<string>,
  toolRenderers: Record<string, unknown>,
): boolean {
  const toolName = getToolName(part);
  if (!toolName || !hoistableToolNames.has(toolName)) return false;
  const renderer = toolRenderers[toolName];
  if (typeof renderer !== 'function') return false;
  return toolRendererAllowsHoist(renderer as never, {
    output:
      part.state === 'output-available'
        ? (part as {output?: unknown}).output
        : undefined,
    input: part.input,
    state: part.state,
  });
}

/**
 * SQLRooms default turn recipe: interleaved prompt → segments (tool groups /
 * agents / text / reasoning) with local ActivityBoxes and near-source hoists.
 */
export const DefaultChatTurn: React.FC<ChatTurnSlotProps> = ({
  model,
  prompt,
  isCompleted,
  searchBlockPrefix,
  hoistableToolNames,
  customMarkdownComponents,
  ErrorMessageComponent,
  canFork,
  onFork,
  allTextContent,
  hasTextContent,
  errorMessage,
  components,
}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const {Prompt, Activity, Reasoning, TextOutput, ToolActivity, Actions} =
    components;

  const lastTextIndex = model.textItems.at(-1)?.index;

  return (
    <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="bg-background sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md text-gray-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)] dark:text-gray-100 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]">
        <Prompt prompt={prompt} searchBlockId={`${searchBlockPrefix}:prompt`} />
      </div>
      <div className="flex w-full flex-col gap-2">
        {model.segments.map((seg, segIdx) => {
          if (seg.kind === 'tool-group') {
            const anyPending = seg.parts.some((p) => {
              const s = (p.part as Record<string, unknown>).state as string;
              return (
                s !== 'output-available' &&
                s !== 'output-error' &&
                s !== 'output-denied'
              );
            });
            const toolCount = seg.parts.length;
            const allToolsDone = !anyPending && toolCount > 0;
            const summaryLabel =
              allToolsDone && isCompleted
                ? `Worked with ${toolCount} tool${toolCount === 1 ? '' : 's'}`
                : undefined;

            return (
              <React.Fragment key={`tg-${segIdx}`}>
                <div data-testid="chat-turn-activity">
                  <Activity
                    isRunning={anyPending}
                    isCompleted={isCompleted}
                    toolCount={toolCount}
                    summaryLabel={summaryLabel}
                  >
                    {seg.parts.map((p) => (
                      <ToolActivity
                        key={`tool-${p.part.toolCallId}`}
                        part={p.part}
                        index={p.index}
                        isAgent={false}
                        isHoisted={isPartHoisted(
                          p.part,
                          hoistableToolNames,
                          toolRenderers,
                        )}
                        searchBlockId={`${searchBlockPrefix}:tool:${p.index}`}
                      />
                    ))}
                  </Activity>
                </div>
                {seg.parts.map((p) => {
                  if (
                    !isPartHoisted(p.part, hoistableToolNames, toolRenderers)
                  ) {
                    return null;
                  }
                  // Match the pre-customization default: hoist via ToolPartRenderer
                  // next to the tool-group (not a chronological turn-body region).
                  return (
                    <div
                      key={`hoisted-${p.part.toolCallId}`}
                      className="empty:hidden"
                      data-testid="chat-turn-hoisted"
                      data-tool-call-id={p.part.toolCallId}
                    >
                      <ToolPartRenderer
                        part={p.part}
                        toolCallId={p.part.toolCallId}
                        hideToolCallInfo
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          }

          if (seg.kind === 'agent-tool') {
            return (
              <ToolActivity
                key={`tool-${seg.part.toolCallId}`}
                part={seg.part}
                index={seg.index}
                isAgent
                isHoisted={false}
                searchBlockId={`${searchBlockPrefix}:tool:${seg.index}`}
              />
            );
          }

          const {part, index} = seg;

          if (isTextPart(part)) {
            return (
              <TextOutput
                key={`text-${index}`}
                text={part.text}
                index={index}
                isAnswer={index === lastTextIndex}
                searchBlockId={`${searchBlockPrefix}:text:${index}`}
                customMarkdownComponents={customMarkdownComponents}
              />
            );
          }

          if (isReasoningPart(part)) {
            if (!part.text.trim()) return null;
            return (
              <Reasoning
                key={`reasoning-${index}`}
                text={part.text}
                isRunning={!isCompleted}
                searchBlockId={`${searchBlockPrefix}:reasoning:${index}`}
              />
            );
          }

          return null;
        })}

        <Actions
          hasTextContent={hasTextContent}
          allTextContent={allTextContent}
          canFork={canFork}
          onFork={onFork}
          errorMessage={errorMessage}
          ErrorMessageComponent={ErrorMessageComponent}
        />
      </div>
    </div>
  );
};

export const defaultChatRenderingComponents: ChatRenderingComponents = {
  Turn: DefaultChatTurn,
  Prompt: DefaultChatPrompt,
  Activity: DefaultChatActivity,
  Reasoning: DefaultChatReasoning,
  TextOutput: DefaultChatTextOutput,
  ToolActivity: DefaultChatToolActivity,
  HoistedOutput: DefaultChatHoistedOutput,
  Actions: DefaultChatActions,
};
