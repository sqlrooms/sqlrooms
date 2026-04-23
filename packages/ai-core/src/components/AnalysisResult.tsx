import {
  AnalysisResultSchema,
  type UIMessagePart,
  type ToolUIPart,
  type DynamicToolUIPart,
} from '@sqlrooms/ai-config';
import {CopyButton} from '@sqlrooms/ui';
import type {UIMessage} from 'ai';
import {SquareTerminalIcon} from 'lucide-react';
import React, {useMemo} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import {useAssistantMessageParts} from '../hooks/useAssistantMessageParts';
import {
  isDynamicToolPart,
  isReasoningPart,
  isTextPart,
  isToolPart,
  shouldSuppressTextPart,
} from '../utils';
import {ActivityBox} from './ActivityBox';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage, type ErrorMessageComponentProps} from './ErrorMessage';
import {ExpandableContent} from './ExpandableContent';
import {OrchestratorToolLogLine} from './FlatAgentRenderer';
import {HoistedRenderersProvider} from './HoistedRenderersContext';
import {ToolPartRenderer} from './ToolPartRenderer';

type AnalysisResultProps = {
  analysisResult: AnalysisResultSchema;
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

// ---------------------------------------------------------------------------
// AnalysisResult
// ---------------------------------------------------------------------------

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  analysisResult,
  customMarkdownComponents,
  hoistedRenderers: userTools,
  ErrorMessageComponent,
}) => {
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages as UIMessage[] | undefined,
  );

  const uiMessageParts = useAssistantMessageParts(
    uiMessages,
    analysisResult.id,
  );

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

  return (
    <HoistedRenderersProvider value={excludeList}>
      <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
        <div className="bg-background sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md text-gray-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)] dark:text-gray-100 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]">
          <div className="group/prompt bg-muted flex w-full items-start gap-2 rounded-md border p-2 text-sm">
            <SquareTerminalIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <ExpandableContent maxHeight={60} showLabels={false}>
                <div className="break-words">{analysisResult.prompt}</div>
              </ExpandableContent>
            </div>
            <div className="shrink-0 opacity-0 transition-opacity group-focus-within/prompt:opacity-100 group-hover/prompt:opacity-100">
              <CopyButton
                text={analysisResult.prompt}
                tooltipLabel="Copy prompt"
                className="h-6 w-6"
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
              return (
                <React.Fragment key={`tg-${segIdx}`}>
                  <ActivityBox isRunning={anyPending}>
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
                <AnalysisAnswer
                  key={`text-${index}`}
                  content={part.text}
                  isAnswer={index === uiMessageParts.length - 1}
                  customMarkdownComponents={customMarkdownComponents}
                />
              );
            }

            if (isReasoningPart(part)) {
              return (
                <div
                  key={`reasoning-${index}`}
                  className="text-muted-foreground text-xs"
                >
                  {part.text}
                </div>
              );
            }

            return null;
          })}
          {analysisResult.errorMessage &&
            (ErrorMessageComponent ? (
              <ErrorMessageComponent
                errorMessage={analysisResult.errorMessage.error}
              />
            ) : (
              <ErrorMessage errorMessage={analysisResult.errorMessage.error} />
            ))}
          {hasTextContent && (
            <div className="flex justify-start">
              <CopyButton
                text={allTextContent}
                tooltipLabel="Copy message"
                className="border-muted border"
              />
            </div>
          )}
        </div>
      </div>
    </HoistedRenderersProvider>
  );
};
