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
import {isReasoningPart, isTextPart} from '../utils';
import {ActivityBox} from './ActivityBox';
import {HighlightedChatSearchText} from './ChatSearch';
import type {
  ChatActionsProps,
  ChatActivityProps,
  ChatHoistedOutputProps,
  ChatPromptProps,
  ChatReasoningProps,
  ChatRenderingComponents,
  ChatTextOutputProps,
  ChatToolActivityProps,
  ChatTurnRegions,
  ChatTurnSlotProps,
} from './ChatRenderingTypes';
import {ErrorMessage, type ErrorMessageComponentProps} from './ErrorMessage';
import {ExpandableContent} from './ExpandableContent';
import {
  HoistedToolCallRenderer,
  OrchestratorToolLogLine,
} from './FlatAgentRenderer';
import {MessageContent} from './MessageContent';
import {ToolPartRenderer} from './ToolPartRenderer';
import type {ChatTurnModel, ChatTurnTextItem} from './buildChatTurnModel';

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

type CreateChatTurnRegionsOptions = {
  model: ChatTurnModel;
  prompt: string;
  isCompleted: boolean;
  searchBlockPrefix: string;
  customMarkdownComponents?: Partial<Components>;
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
  canFork: boolean;
  onFork?: () => void;
  allTextContent: string;
  hasTextContent: boolean;
  errorMessage?: string;
  activitySummaryLabel?: string;
  computationTimeMs?: number;
  computationTimeLabel?: string;
  responseText: ChatTurnTextItem[];
  summaryText: ChatTurnTextItem[];
  components: ChatRenderingComponents;
};

/** Builds the data-bound regions consumed by a turn layout recipe. */
export function createChatTurnRegions({
  model,
  prompt,
  isCompleted,
  searchBlockPrefix,
  customMarkdownComponents,
  ErrorMessageComponent,
  canFork,
  onFork,
  allTextContent,
  hasTextContent,
  errorMessage,
  activitySummaryLabel,
  computationTimeMs,
  computationTimeLabel,
  responseText,
  summaryText,
  components,
}: CreateChatTurnRegionsOptions): ChatTurnRegions {
  const {
    Prompt,
    Activity,
    Reasoning,
    TextOutput,
    ToolActivity,
    HoistedOutput,
    Actions,
  } = components;
  const hoistedById = new Map(
    model.hoisted.map((item) => [item.toolCallId, item]),
  );
  const lastTextIndex = model.textItems.at(-1)?.index;

  const PromptRegion = () => (
    <Prompt prompt={prompt} searchBlockId={`${searchBlockPrefix}:prompt`} />
  );

  const TimelineRegion = () => (
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
                  {segment.parts.map(({part, index}) => (
                    <ToolActivity
                      key={`tool-${part.toolCallId}`}
                      part={part}
                      index={index}
                      isAgent={false}
                      isHoisted={hoistedById.has(part.toolCallId)}
                      searchBlockId={`${searchBlockPrefix}:tool:${index}`}
                    />
                  ))}
                </Activity>
              </div>
              {segment.parts.map(({part}) => {
                const item = hoistedById.get(part.toolCallId);
                return item ? (
                  <div
                    key={`hoisted-${part.toolCallId}`}
                    className="empty:hidden"
                    data-testid="chat-turn-hoisted"
                    data-tool-call-id={part.toolCallId}
                  >
                    <HoistedOutput item={item} />
                  </div>
                ) : null;
              })}
            </React.Fragment>
          );
        }

        if (segment.kind === 'agent-tool') {
          return (
            <ToolActivity
              key={`tool-${segment.part.toolCallId}`}
              part={segment.part}
              index={segment.index}
              isAgent
              isHoisted={false}
              searchBlockId={`${searchBlockPrefix}:tool:${segment.index}`}
            />
          );
        }

        const {part, index} = segment;
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
        if (isReasoningPart(part) && part.text.trim()) {
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
    </>
  );

  const ActivityRegion = () =>
    model.activity.length > 0 ? (
      <Activity
        isRunning={model.isActivityRunning}
        isCompleted={isCompleted}
        toolCount={model.leafToolCount}
        summaryLabel={activitySummaryLabel}
        computationTimeMs={computationTimeMs}
        computationTimeLabel={computationTimeLabel}
      >
        {model.activity.map((item) =>
          item.kind === 'reasoning' ? (
            <Reasoning
              key={`reasoning-${item.index}`}
              text={item.text}
              isRunning={!isCompleted}
              searchBlockId={`${searchBlockPrefix}:reasoning:${item.index}`}
            />
          ) : (
            <ToolActivity
              key={`tool-${item.part.toolCallId}`}
              part={item.part}
              index={item.index}
              isAgent={item.isAgent}
              isHoisted={item.isHoisted}
              searchBlockId={`${searchBlockPrefix}:tool:${item.index}`}
            />
          ),
        )}
      </Activity>
    ) : null;

  const ResponseRegion = () => (
    <>
      {renderTextItems(
        responseText,
        summaryText.length === 0,
        TextOutput,
        searchBlockPrefix,
        customMarkdownComponents,
      )}
    </>
  );

  const HoistedOutputsRegion = () => (
    <>
      {model.hoisted.map((item) => (
        <HoistedOutput key={item.toolCallId} item={item} />
      ))}
    </>
  );

  const SummaryRegion = () => (
    <>
      {renderTextItems(
        summaryText,
        true,
        TextOutput,
        searchBlockPrefix,
        customMarkdownComponents,
      )}
    </>
  );

  const ActionsRegion = () => (
    <Actions
      hasTextContent={hasTextContent}
      allTextContent={allTextContent}
      canFork={canFork}
      onFork={onFork}
      errorMessage={errorMessage}
      ErrorMessageComponent={ErrorMessageComponent}
    />
  );

  return {
    Prompt: PromptRegion,
    Timeline: TimelineRegion,
    Activity: ActivityRegion,
    Response: ResponseRegion,
    HoistedOutputs: HoistedOutputsRegion,
    Summary: SummaryRegion,
    Actions: ActionsRegion,
  };
}

function isToolPartPending(state: string): boolean {
  return (
    state !== 'output-available' &&
    state !== 'output-error' &&
    state !== 'output-denied'
  );
}

function renderTextItems(
  items: ChatTurnTextItem[],
  markLastAsAnswer: boolean,
  TextOutput: ChatRenderingComponents['TextOutput'],
  searchBlockPrefix: string,
  customMarkdownComponents?: Partial<Components>,
): React.ReactNode {
  const lastIndex = items.at(-1)?.index;
  return items.map((item) => (
    <TextOutput
      key={`text-${item.index}`}
      text={item.text}
      index={item.index}
      isAnswer={markLastAsAnswer && item.index === lastIndex}
      searchBlockId={`${searchBlockPrefix}:text:${item.index}`}
      customMarkdownComponents={customMarkdownComponents}
    />
  ));
}

/** SQLRooms default source-order turn layout. */
export const DefaultChatTurn: React.FC<ChatTurnSlotProps> = ({regions}) => {
  const {Prompt, Timeline, Actions} = regions;
  return (
    <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="bg-background sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md text-gray-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)] dark:text-gray-100 dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]">
        <Prompt />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Timeline />
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
    Actions: DefaultChatActions,
  });
