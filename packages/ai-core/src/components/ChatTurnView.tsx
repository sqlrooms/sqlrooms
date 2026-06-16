import {
  AnalysisResultSchema,
  type UIMessagePart,
  type ToolUIPart,
  type DynamicToolUIPart,
} from '@sqlrooms/ai-config';
import {
  Button,
  CopyButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import type {UIMessage} from 'ai';
import {SplitIcon, SquareTerminalIcon} from 'lucide-react';
import React, {useMemo} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import {TOOL_CALL_CANCELLED} from '../constants';
import type {ChatTurn} from '../chatTurns';
import {useAssistantMessageParts} from '../hooks/useAssistantMessageParts';
import {
  isDynamicToolPart,
  isReasoningPart,
  isTextPart,
  isToolPart,
  shouldSuppressTextPart,
} from '../utils';
import {ActivityBox} from './ActivityBox';
import {MessageContent, processMessageContent} from './MessageContent';
import {
  HighlightedChatSearchText,
  markdownToPlainText,
  normalizeChatSearchQuery,
  useOptionalChatSearch,
  useRegisterChatSearchBlocks,
  type ChatSearchBlock,
} from './ChatSearch';
import {ErrorMessage, type ErrorMessageComponentProps} from './ErrorMessage';
import {ExpandableContent} from './ExpandableContent';
import {OrchestratorToolLogLine} from './FlatAgentRenderer';
import {HoistedRenderersProvider} from './HoistedRenderersContext';
import {ToolPartRenderer} from './ToolPartRenderer';

export type ChatTurnViewProps = {
  /** @deprecated Prefer `chatTurn`; this accepts the legacy derived result shape. */
  analysisResult?: AnalysisResultSchema;
  chatTurn?: ChatTurn;
  customMarkdownComponents?: Partial<Components>;
  hoistedRenderers?: string[];
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
};

// ---------------------------------------------------------------------------
// Helpers: classify and group message parts into render segments
// ---------------------------------------------------------------------------

function getToolName(part: UIMessagePart): string | undefined {
  if (isDynamicToolPart(part)) return part.toolName;
  if (isToolPart(part)) return part.type.replace(/^tool-/, '') || undefined;
  return undefined;
}

function isAgentToolPart(
  part: UIMessagePart,
  agentProgress: Record<string, unknown[]>,
): boolean {
  const name = getToolName(part);
  if (!name) return false;
  if (name.startsWith('agent-')) return true;

  const toolCallId = (part as {toolCallId?: string}).toolCallId;
  if (toolCallId && (agentProgress[toolCallId]?.length ?? 0) > 0) return true;

  const output = (part as {output?: {agentToolCalls?: unknown[]}}).output;
  if (output?.agentToolCalls?.length) return true;

  return false;
}

function isNonAgentToolPart(
  part: UIMessagePart,
  agentProgress: Record<string, unknown[]>,
): boolean {
  return (
    (isToolPart(part) || isDynamicToolPart(part)) &&
    !isAgentToolPart(part, agentProgress)
  );
}

type ToolPartWithId = ToolUIPart | DynamicToolUIPart;

type PartSegment =
  | {kind: 'other'; part: UIMessagePart; index: number}
  | {kind: 'agent-tool'; part: ToolPartWithId; index: number}
  | {kind: 'tool-group'; parts: Array<{part: ToolPartWithId; index: number}>};

function groupPartsIntoSegments(
  parts: UIMessagePart[],
  suppressedIndices: Set<number>,
  agentProgress: Record<string, unknown[]>,
): PartSegment[] {
  const segments: PartSegment[] = [];
  let pendingTools: Array<{part: ToolPartWithId; index: number}> = [];

  const flushTools = () => {
    if (pendingTools.length > 0) {
      segments.push({kind: 'tool-group', parts: pendingTools});
      pendingTools = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (suppressedIndices.has(i)) continue;
    if (typeof part.type === 'string' && part.type.startsWith('step-'))
      continue;

    if (isNonAgentToolPart(part, agentProgress)) {
      pendingTools.push({part: part as ToolPartWithId, index: i});
    } else if (isAgentToolPart(part, agentProgress)) {
      flushTools();
      segments.push({
        kind: 'agent-tool',
        part: part as ToolPartWithId,
        index: i,
      });
    } else {
      flushTools();
      segments.push({kind: 'other', part, index: i});
    }
  }
  flushTools();
  return segments;
}

const ReasoningBox: React.FC<{
  isRunning: boolean;
  children: React.ReactNode;
}> = ({isRunning, children}) => {
  return (
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
        {children}
      </div>
    </details>
  );
};

// ---------------------------------------------------------------------------
// ChatTurnView
// ---------------------------------------------------------------------------

export const ChatTurnView: React.FC<ChatTurnViewProps> = ({
  analysisResult,
  chatTurn,
  customMarkdownComponents,
  hoistedRenderers: userTools,
  ErrorMessageComponent,
}) => {
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages as UIMessage[] | undefined,
  );
  const forkSessionFromMessage = useStoreWithAi(
    (s) => s.ai.forkSessionFromMessage,
  );

  const fallbackMessageParts = useAssistantMessageParts(
    uiMessages,
    analysisResult?.id ?? '',
  );

  const uiMessageParts = useMemo(
    () =>
      chatTurn
        ? chatTurn.assistantMessages.flatMap(
            (message) => message.parts as UIMessagePart[],
          )
        : fallbackMessageParts,
    [chatTurn, fallbackMessageParts],
  );
  const turnId = chatTurn?.id ?? analysisResult?.id ?? '';
  const prompt = chatTurn?.prompt ?? analysisResult?.prompt ?? '';
  const isCompleted =
    chatTurn?.isCompleted ?? analysisResult?.isCompleted ?? true;
  const errorMessage = chatTurn?.errorMessage ?? analysisResult?.errorMessage;

  const allTextContent = uiMessageParts
    .flatMap((part) =>
      isTextPart(part) || isReasoningPart(part) ? [part.text] : [],
    )
    .join('\n\n');
  const hasTextContent = allTextContent.trim().length > 0;

  const excludeList = useMemo(() => userTools ?? [], [userTools]);

  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);

  const suppressedIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < uiMessageParts.length; i++) {
      const part = uiMessageParts[i];
      if (!part) continue;
      if (isTextPart(part)) {
        const text = part.text?.trim();
        if (text && shouldSuppressTextPart(text, uiMessageParts.slice(i + 1))) {
          set.add(i);
        }
      }
    }
    return set;
  }, [uiMessageParts]);

  const segments = useMemo(
    () =>
      groupPartsIntoSegments(uiMessageParts, suppressedIndices, agentProgress),
    [uiMessageParts, suppressedIndices, agentProgress],
  );

  const hoistableSet = useMemo(() => new Set(excludeList), [excludeList]);

  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const currentSessionId = useStoreWithAi(
    (s) => s.ai.config.currentSessionId ?? '',
  );
  const forkSourceMessage = chatTurn?.assistantMessages.at(-1);
  const forkSourceMessageIndex =
    forkSourceMessage && uiMessages
      ? uiMessages.findIndex((message) => message.id === forkSourceMessage.id)
      : undefined;
  const canFork =
    !!chatTurn && !!forkSourceMessage && !!currentSessionId && isCompleted;
  const searchBlockPrefix = `${currentSessionId}:${turnId}`;

  const search = useOptionalChatSearch();
  const hasActiveQuery =
    !!search && normalizeChatSearchQuery(search.query).length > 0;

  const searchBlocks = useMemo<ChatSearchBlock[]>(() => {
    if (!hasActiveQuery) return [];
    const blocks: ChatSearchBlock[] = [
      {
        id: `${searchBlockPrefix}:prompt`,
        resultId: turnId,
        text: prompt,
      },
    ];

    uiMessageParts.forEach((part, index) => {
      if (isTextPart(part)) {
        blocks.push({
          id: `${searchBlockPrefix}:text:${index}`,
          resultId: turnId,
          text: markdownToPlainText(
            processMessageContent(part.text).processedContent,
          ),
        });
      } else if (isReasoningPart(part)) {
        blocks.push({
          id: `${searchBlockPrefix}:reasoning:${index}`,
          resultId: turnId,
          text: part.text,
        });
      } else if (isToolPart(part) || isDynamicToolPart(part)) {
        const toolName = getToolName(part);
        if (toolName) {
          blocks.push({
            id: `${searchBlockPrefix}:tool:${index}`,
            resultId: turnId,
            text: toolName,
          });
        }
      }
    });

    return blocks.filter((block) => block.text.trim().length > 0);
  }, [turnId, prompt, hasActiveQuery, searchBlockPrefix, uiMessageParts]);

  useRegisterChatSearchBlocks(searchBlockPrefix, searchBlocks);

  return (
    <HoistedRenderersProvider value={excludeList}>
      <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
        <div className="bg-background sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md text-gray-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)] dark:text-gray-100 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]">
          <div className="group/prompt bg-muted flex w-full items-start gap-2 rounded-md border p-2 text-sm">
            <SquareTerminalIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <ExpandableContent maxHeight={60} showLabels={false}>
                <div className="break-words">
                  <HighlightedChatSearchText
                    blockId={`${searchBlockPrefix}:prompt`}
                    text={prompt}
                  />
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
        </div>
        <div className="flex w-full flex-col gap-2">
          {segments.map((seg, segIdx) => {
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
                  <ActivityBox
                    isRunning={anyPending}
                    summaryLabel={summaryLabel}
                  >
                    {seg.parts.map((p) => {
                      const toolName = getToolName(p.part);
                      const isHoisted =
                        !!toolName &&
                        hoistableSet.has(toolName) &&
                        typeof toolRenderers[toolName] === 'function';
                      return (
                        <React.Fragment key={`tool-${p.part.toolCallId}`}>
                          <OrchestratorToolLogLine
                            part={p.part}
                            toolCallId={p.part.toolCallId}
                            searchBlockId={`${searchBlockPrefix}:tool:${p.index}`}
                          />
                          {!isHoisted && (
                            <ToolPartRenderer
                              part={p.part}
                              toolCallId={p.part.toolCallId}
                              hideToolCallInfo
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </ActivityBox>
                  {seg.parts.map((p) => {
                    const toolName = getToolName(p.part);
                    const isHoisted =
                      !!toolName &&
                      hoistableSet.has(toolName) &&
                      typeof toolRenderers[toolName] === 'function';
                    if (!isHoisted) return null;
                    return (
                      <ToolPartRenderer
                        key={`hoisted-${p.part.toolCallId}`}
                        part={p.part}
                        toolCallId={p.part.toolCallId}
                        hideToolCallInfo
                      />
                    );
                  })}
                </React.Fragment>
              );
            }

            if (seg.kind === 'agent-tool') {
              return (
                <ToolPartRenderer
                  key={`tool-${seg.part.toolCallId}`}
                  part={seg.part}
                  toolCallId={seg.part.toolCallId}
                />
              );
            }

            const {part, index} = seg;

            if (isTextPart(part)) {
              return (
                <MessageContent
                  key={`text-${index}`}
                  content={part.text}
                  isAnswer={index === uiMessageParts.length - 1}
                  searchBlockId={`${searchBlockPrefix}:text:${index}`}
                  customMarkdownComponents={customMarkdownComponents}
                />
              );
            }

            if (isReasoningPart(part)) {
              if (!part.text.trim()) return null;
              return (
                <ReasoningBox
                  key={`reasoning-${index}`}
                  isRunning={!isCompleted}
                >
                  <HighlightedChatSearchText
                    blockId={`${searchBlockPrefix}:reasoning:${index}`}
                    text={part.text}
                  />
                </ReasoningBox>
              );
            }

            return null;
          })}
          {errorMessage &&
            !errorMessage.error.startsWith(TOOL_CALL_CANCELLED) &&
            (ErrorMessageComponent ? (
              <ErrorMessageComponent errorMessage={errorMessage.error} />
            ) : (
              <ErrorMessage errorMessage={errorMessage.error} />
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
                      onClick={() => {
                        forkSessionFromMessage({
                          sourceSessionId: currentSessionId,
                          sourceMessageId: forkSourceMessage.id,
                          sourceTurnId: chatTurn.id,
                          ...(forkSourceMessageIndex !== undefined &&
                          forkSourceMessageIndex >= 0
                            ? {sourceMessageIndex: forkSourceMessageIndex}
                            : {}),
                          ...(analysisResult?.id
                            ? {legacySourceAnalysisResultId: analysisResult.id}
                            : {}),
                        });
                      }}
                    >
                      <SplitIcon className="h-4 w-4 rotate-90" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fork</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </HoistedRenderersProvider>
  );
};
