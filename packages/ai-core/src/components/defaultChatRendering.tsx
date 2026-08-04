import {
  Button,
  CopyButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {SplitIcon, SquareTerminalIcon} from 'lucide-react';
import React from 'react';
import type {Components} from 'react-markdown';
import {TOOL_CALL_CANCELLED} from '../constants';
import type {AgentToolCall} from '../types';
import {isReasoningPart, isTextPart} from '../utils';
import {ActivityBox} from './ActivityBox';
import {HighlightedChatSearchText} from './ChatSearch';
import type {
  ChatActionsProps,
  ChatActivityItem,
  ChatActivityProps,
  ChatErrorProps,
  ChatHoistedOutputProps,
  ChatOutputItem,
  ChatPromptProps,
  ChatReasoningProps,
  ChatRenderingComponents,
  ChatTextItem,
  ChatTextOutputProps,
  ChatToolActivityProps,
  ChatTurnPresentation,
  ChatTurnSlotProps,
} from './ChatRenderingTypes';
import {ErrorMessage, type ErrorMessageComponentProps} from './ErrorMessage';
import {ExpandableContent} from './ExpandableContent';
import {
  AgentToolActivityLogLine,
  AgentToolSummaryLine,
  HoistedToolCallRenderer,
  OrchestratorToolLogLine,
} from './FlatAgentRenderer';
import {MessageContent} from './MessageContent';
import {RenderNestedHoistedOutputsProvider} from './NestedHoistedOutputsContext';
import {ToolPartRenderer} from './ToolPartRenderer';
import {
  getToolName,
  mapUiToolStateToAgentState,
  type ChatTurnModel,
  type ChatTurnTextItem,
} from './buildChatTurnModel';
import type {ChatTurnContentBinder} from './useChatTurnContentBinder';

/** SQLRooms default user-prompt presentation. */
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

/** SQLRooms default collapsible activity chrome. */
export const DefaultChatActivity: React.FC<ChatActivityProps> = ({
  children,
  isRunning,
  summaryLabel,
  computationTimeLabel,
  className,
}) => {
  const combinedSummaryLabel = [summaryLabel, computationTimeLabel]
    .filter(Boolean)
    .join(' · ');
  return (
    <ActivityBox
      isRunning={isRunning}
      summaryLabel={combinedSummaryLabel || undefined}
      className={className}
    >
      {children}
    </ActivityBox>
  );
};

/** SQLRooms default reasoning disclosure. */
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

/** SQLRooms default assistant markdown presentation. */
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

/** SQLRooms default tool and nested-agent activity presentation. */
export const DefaultChatToolActivity: React.FC<ChatToolActivityProps> = ({
  toolCall,
  part,
  isAgent,
  isHoisted,
  searchBlockId,
}) => {
  if (!part) {
    return isAgent ? (
      <AgentToolSummaryLine
        toolCallId={toolCall.toolCallId}
        toolName={toolCall.toolName}
        isComplete={toolCall.state === 'success' || toolCall.state === 'error'}
        startedAt={toolCall.startedAt}
        completedAt={toolCall.completedAt}
        toolCall={toolCall}
      />
    ) : (
      <AgentToolActivityLogLine toolCall={toolCall} />
    );
  }

  if (isAgent) {
    if (!toolCall.agentToolCalls?.length) return null;
    return (
      <AgentToolSummaryLine
        toolCallId={toolCall.toolCallId}
        toolName={toolCall.toolName}
        isComplete={toolCall.state === 'success' || toolCall.state === 'error'}
        startedAt={toolCall.startedAt}
        completedAt={toolCall.completedAt}
        toolCall={toolCall}
      />
    );
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

/** SQLRooms default rich hoisted-output presentation. */
export const DefaultChatHoistedOutput: React.FC<ChatHoistedOutputProps> = ({
  item,
}) => <HoistedToolCallRenderer item={item} />;

/** SQLRooms default turn error presentation. */
export const DefaultChatError: React.FC<ChatErrorProps> = ({message}) => (
  <ErrorMessage errorMessage={message} />
);

const DefaultChatCopyAction: React.FC<{text: string}> = ({text}) => (
  <CopyButton
    text={text}
    tooltipLabel="Copy message"
    className="border-muted border"
  />
);

const DefaultChatForkAction: React.FC<{run: () => void}> = ({run}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="border-muted text-muted-foreground hover:text-foreground h-8 w-8 border"
        aria-label="Fork chat from this message"
        onClick={run}
      >
        <SplitIcon className="h-4 w-4 rotate-90" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Fork</TooltipContent>
  </Tooltip>
);

/** SQLRooms default action-row layout. */
export const DefaultChatActions: React.FC<ChatActionsProps> = ({
  copy,
  fork,
}) => {
  if (!copy && !fork) return null;
  const Copy = copy?.Content;
  const Fork = fork?.Content;
  return (
    <div className="flex justify-start gap-1">
      {Copy && <Copy />}
      {Fork && <Fork />}
    </div>
  );
};

type CreateChatTurnPresentationOptions = {
  turnId: string;
  model: ChatTurnModel;
  prompt: string;
  isCompleted: boolean;
  searchBlockPrefix: string;
  customMarkdownComponents?: Partial<Components>;
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
  canFork: boolean;
  onFork?: () => void;
  copyText?: string;
  errorMessage?: string;
  activitySummaryLabel?: string;
  computationTimeMs?: number;
  computationTimeLabel?: string;
  responseText: ChatTurnTextItem[];
  summaryText: ChatTurnTextItem[];
  components: ChatRenderingComponents;
  /**
   * Binds each pre-wired component to a stable identity so rebuilding the
   * presentation re-renders rich output instead of remounting it.
   */
  bindContent: ChatTurnContentBinder;
};

/** Builds semantic turn data with pre-wired rendering components. */
export function createChatTurnPresentation({
  turnId,
  model,
  prompt,
  isCompleted,
  searchBlockPrefix,
  customMarkdownComponents,
  ErrorMessageComponent,
  canFork,
  onFork,
  copyText,
  errorMessage,
  activitySummaryLabel,
  computationTimeMs,
  computationTimeLabel,
  responseText,
  summaryText,
  components,
  bindContent,
}: CreateChatTurnPresentationOptions): ChatTurnPresentation {
  const {
    Prompt,
    Activity,
    Reasoning,
    TextOutput,
    ToolActivity,
    HoistedOutput,
    Error,
    Actions,
  } = components;
  const PromptContent = bindContent('prompt', () => (
    <Prompt prompt={prompt} searchBlockId={`${searchBlockPrefix}:prompt`} />
  ));

  const isActivityRunning =
    model.isActivityRunning ||
    (!isCompleted && model.activity.some((item) => item.kind === 'reasoning'));

  const timelineAgentContentByIndex = new Map<number, React.ElementType>();

  const activityItems: ChatActivityItem[] = model.activity.map((item) => {
    if (item.kind === 'reasoning') {
      const id = `reasoning-${item.index}`;
      const Content = bindContent(`activity:${id}`, () => (
        <Reasoning
          text={item.text}
          isRunning={!isCompleted}
          searchBlockId={`${searchBlockPrefix}:reasoning:${item.index}`}
        />
      ));
      return {
        id,
        kind: 'reasoning',
        text: item.text,
        Content,
      };
    }

    const toolCall: AgentToolCall = {
      toolCallId: item.part.toolCallId,
      toolName: getToolName(item.part) ?? 'tool',
      input: item.part.input,
      output:
        item.part.state === 'output-available' ? item.part.output : undefined,
      errorText:
        item.part.state === 'output-error' ? item.part.errorText : undefined,
      state: mapUiToolStateToAgentState(item.part.state),
      approvalId:
        item.part.state === 'approval-requested'
          ? item.part.approval.id
          : undefined,
      agentToolCalls: item.agentToolCalls,
    };
    const renderToolActivity = () => (
      <>
        <ToolActivity
          toolCall={toolCall}
          part={item.part}
          index={item.index}
          isAgent={item.isAgent}
          isHoisted={item.isHoisted}
          searchBlockId={`${searchBlockPrefix}:tool:${item.index}`}
        />
        {item.isAgent && (
          <ToolPartRenderer
            part={item.part}
            toolCallId={item.part.toolCallId}
            hideAgentSummary
          />
        )}
      </>
    );
    const Content = bindContent(`activity:${item.part.toolCallId}`, () => (
      <RenderNestedHoistedOutputsProvider value={false}>
        {renderToolActivity()}
      </RenderNestedHoistedOutputsProvider>
    ));
    if (item.isAgent) {
      timelineAgentContentByIndex.set(
        item.index,
        bindContent(`timeline:agent:${item.part.toolCallId}`, () => (
          <RenderNestedHoistedOutputsProvider value>
            {renderToolActivity()}
          </RenderNestedHoistedOutputsProvider>
        )),
      );
    }
    return {
      id: item.part.toolCallId,
      kind: 'tool',
      toolName: getToolName(item.part) ?? 'tool',
      state: item.state,
      isAgent: item.isAgent,
      isHoisted: item.isHoisted,
      Content,
    };
  });
  const activityByIndex = new Map(
    model.activity.map((item, index) => [item.index, activityItems[index]]),
  );

  const response = createTextItems(
    responseText,
    model.answerTextIndex,
    TextOutput,
    searchBlockPrefix,
    bindContent,
    customMarkdownComponents,
  );
  const summary = createTextItems(
    summaryText,
    model.answerTextIndex,
    TextOutput,
    searchBlockPrefix,
    bindContent,
    customMarkdownComponents,
  );
  const textByIndex = new Map(
    [...response.items, ...summary.items].map((item) => [
      Number(item.id.slice('text-'.length)),
      item,
    ]),
  );

  const outputItems: ChatOutputItem[] = model.hoisted.map((item) => {
    const Content = bindContent(`output:${item.toolCallId}`, () => (
      <HoistedOutput item={item} />
    ));
    return {
      id: item.toolCallId,
      toolName: item.toolName,
      state: item.state,
      Content,
    };
  });
  const outputById = new Map(outputItems.map((item) => [item.id, item]));

  const TimelineContent = bindContent('timeline', () => (
    <>
      {model.segments.map((segment, segmentIndex) => {
        if (segment.kind === 'tool-group') {
          const anyPending = segment.parts.some(({part}) =>
            isToolPartPending(part.state),
          );
          const toolCount = segment.parts.length;
          const summaryLabel =
            !anyPending && toolCount > 0 && isCompleted
              ? `Worked with ${toolCount} tool${toolCount === 1 ? '' : 's'}`
              : undefined;

          return (
            <React.Fragment key={`tool-group-${segmentIndex}`}>
              <div data-testid="chat-turn-activity">
                <Activity
                  isRunning={anyPending}
                  isCompleted={isCompleted}
                  toolCount={toolCount}
                  summaryLabel={summaryLabel}
                >
                  {segment.parts.map(({part, index}) => {
                    const item = activityByIndex.get(index);
                    if (!item) return null;
                    const Content = item.Content;
                    return <Content key={`tool-${part.toolCallId}`} />;
                  })}
                </Activity>
              </div>
              {segment.parts.map(({part}) => {
                const item = outputById.get(part.toolCallId);
                if (!item) return null;
                const Content = item.Content;
                return (
                  <div
                    key={`hoisted-${part.toolCallId}`}
                    className="empty:hidden"
                    data-testid="chat-turn-hoisted"
                    data-tool-call-id={part.toolCallId}
                  >
                    <Content />
                  </div>
                );
              })}
            </React.Fragment>
          );
        }

        if (segment.kind === 'agent-tool') {
          const Content = timelineAgentContentByIndex.get(segment.index);
          if (!Content) return null;
          return <Content key={`tool-${segment.part.toolCallId}`} />;
        }

        const {part, index} = segment;
        if (isTextPart(part)) {
          const item = textByIndex.get(index);
          if (!item) return null;
          const Content = item.Content;
          return <Content key={`text-${index}`} />;
        }
        if (isReasoningPart(part) && part.text.trim()) {
          const item = activityByIndex.get(index);
          if (!item) return null;
          const Content = item.Content;
          return <Content key={`reasoning-${index}`} />;
        }
        return null;
      })}
    </>
  ));

  const ActivityContent = bindContent('activity', () =>
    model.activity.length > 0 ? (
      <Activity
        isRunning={isActivityRunning}
        isCompleted={isCompleted}
        toolCount={model.leafToolCount}
        summaryLabel={activitySummaryLabel}
        computationTimeMs={computationTimeMs}
        computationTimeLabel={computationTimeLabel}
      >
        {activityItems.map((item) => {
          const Content = item.Content;
          return <Content key={item.id} />;
        })}
      </Activity>
    ) : null,
  );

  const ResponseContent = bindContent('response', () => (
    <>{renderItems(response.items)}</>
  ));

  const HoistedOutputsContent = bindContent('hoistedOutputs', () => (
    <>{renderItems(outputItems)}</>
  ));

  const SummaryContent = bindContent('summary', () => (
    <>{renderItems(summary.items)}</>
  ));

  const copy = copyText
    ? {
        text: copyText,
        Content: bindContent('action:copy', () => (
          <DefaultChatCopyAction text={copyText} />
        )),
      }
    : undefined;
  const fork =
    canFork && onFork
      ? {
          run: onFork,
          Content: bindContent('action:fork', () => (
            <DefaultChatForkAction run={onFork} />
          )),
        }
      : undefined;
  const visibleErrorMessage =
    errorMessage && !errorMessage.startsWith(TOOL_CALL_CANCELLED)
      ? errorMessage
      : undefined;
  const error = visibleErrorMessage
    ? {
        message: visibleErrorMessage,
        Content: bindContent('error', () =>
          ErrorMessageComponent ? (
            <ErrorMessageComponent errorMessage={visibleErrorMessage} />
          ) : (
            <Error message={visibleErrorMessage} />
          ),
        ),
      }
    : undefined;
  const actionProps: ChatActionsProps = {
    ...(copy ? {copy} : {}),
    ...(fork ? {fork} : {}),
  };
  const ActionsContent = bindContent('actions', () => (
    <Actions {...actionProps} />
  ));

  return {
    id: turnId,
    isCompleted,
    prompt: {text: prompt, Content: PromptContent},
    activity: {
      isRunning: isActivityRunning,
      toolCount: model.leafToolCount,
      computationTimeMs,
      items: activityItems,
      Content: ActivityContent,
    },
    response: {items: response.items, Content: ResponseContent},
    hoistedOutputs: {
      items: outputItems,
      Content: HoistedOutputsContent,
    },
    summary: {items: summary.items, Content: SummaryContent},
    ...(error ? {error} : {}),
    actions: {...actionProps, Content: ActionsContent},
    timeline: {Content: TimelineContent},
  };
}

function isToolPartPending(state: string): boolean {
  return (
    state !== 'output-available' &&
    state !== 'output-error' &&
    state !== 'output-denied'
  );
}

function createTextItems(
  items: ChatTurnTextItem[],
  answerTextIndex: number | null,
  TextOutput: ChatRenderingComponents['TextOutput'],
  searchBlockPrefix: string,
  bindContent: ChatTurnContentBinder,
  customMarkdownComponents?: Partial<Components>,
): {items: ChatTextItem[]} {
  return {
    items: items.map((item) => {
      const isAnswer = item.index === answerTextIndex;
      const id = `text-${item.index}`;
      const Content = bindContent(id, () => (
        <TextOutput
          text={item.text}
          index={item.index}
          isAnswer={isAnswer}
          searchBlockId={`${searchBlockPrefix}:text:${item.index}`}
          customMarkdownComponents={customMarkdownComponents}
        />
      ));
      return {id, text: item.text, isAnswer, Content};
    }),
  };
}

function renderItems(
  items: readonly {id: string; Content: React.ElementType}[],
): React.ReactNode {
  return items.map((item) => {
    const Content = item.Content;
    return <Content key={item.id} />;
  });
}

/** SQLRooms default source-order turn layout. */
export const DefaultChatTurn: React.FC<ChatTurnSlotProps> = ({turn}) => {
  const Prompt = turn.prompt.Content;
  const Timeline = turn.timeline.Content;
  const Error = turn.error?.Content;
  const Actions = turn.actions.Content;
  return (
    <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="bg-background sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md text-gray-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)] dark:text-gray-100 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]">
        <Prompt />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Timeline />
        {Error && <Error />}
        <Actions />
      </div>
    </div>
  );
};

/** Built-in SQLRooms rendering recipe. */
export const defaultChatRenderingComponents: Readonly<ChatRenderingComponents> =
  Object.freeze({
    Turn: DefaultChatTurn,
    Prompt: DefaultChatPrompt,
    Activity: DefaultChatActivity,
    Reasoning: DefaultChatReasoning,
    TextOutput: DefaultChatTextOutput,
    ToolActivity: DefaultChatToolActivity,
    HoistedOutput: DefaultChatHoistedOutput,
    Error: DefaultChatError,
    Actions: DefaultChatActions,
  });
