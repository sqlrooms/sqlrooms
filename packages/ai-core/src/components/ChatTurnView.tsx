import {AnalysisResultSchema, type UIMessagePart} from '@sqlrooms/ai-config';
import {formatShortDuration} from '@sqlrooms/utils';
import type {UIMessage} from 'ai';
import React, {useMemo} from 'react';
import {Components} from 'react-markdown';
import {useStoreWithAi} from '../AiSlice';
import type {ChatTurn} from '../chatTurns';
import {useAssistantMessageParts} from '../hooks/useAssistantMessageParts';
import type {AgentToolCall} from '../types';
import {
  isDynamicToolPart,
  isReasoningPart,
  isTextPart,
  isToolPart,
} from '../utils';
import {
  buildChatTurnModel,
  computeComputationTimeMs,
  getToolName,
  splitTextAroundHoists,
} from './buildChatTurnModel';
import {useChatRenderingComponents} from './ChatRenderingContext';
import {
  markdownToPlainText,
  normalizeChatSearchQuery,
  useOptionalChatSearch,
  useRegisterChatSearchBlocks,
  type ChatSearchBlock,
} from './ChatSearch';
import type {ErrorMessageComponentProps} from './ErrorMessage';
import {HoistedRenderersProvider} from './HoistedRenderersContext';
import {processMessageContent} from './MessageContent';
import {createChatTurnRegions} from './defaultChatRendering';

export type ChatTurnViewProps = {
  /** @deprecated Prefer `chatTurn`; this accepts the legacy derived result shape. */
  analysisResult?: AnalysisResultSchema;
  chatTurn?: ChatTurn;
  customMarkdownComponents?: Partial<Components>;
  hoistedRenderers?: string[];
  ErrorMessageComponent?: React.ComponentType<ErrorMessageComponentProps>;
};

export const ChatTurnView: React.FC<ChatTurnViewProps> = ({
  analysisResult,
  chatTurn,
  customMarkdownComponents,
  hoistedRenderers: userTools,
  ErrorMessageComponent,
}) => {
  const components = useChatRenderingComponents();
  const {Turn} = components;

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
  const hoistableSet = useMemo(() => new Set(excludeList), [excludeList]);

  const agentProgress = useStoreWithAi(
    (s) => s.ai.agentProgress as Record<string, AgentToolCall[]>,
  );
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const toolTimings = useStoreWithAi((s) => s.ai.toolTimings);

  const model = useMemo(
    () =>
      buildChatTurnModel({
        parts: uiMessageParts,
        agentProgress,
        toolRenderers,
        hoistableToolNames: hoistableSet,
      }),
    [uiMessageParts, agentProgress, toolRenderers, hoistableSet],
  );

  const {responseText, summaryText} = useMemo(
    () => splitTextAroundHoists(model),
    [model],
  );

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
        const isSuppressed = !model.textItems.some(
          (item) => item.index === index,
        );
        if (isSuppressed) return;
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
  }, [
    turnId,
    prompt,
    hasActiveQuery,
    searchBlockPrefix,
    uiMessageParts,
    model.textItems,
  ]);

  useRegisterChatSearchBlocks(searchBlockPrefix, searchBlocks);

  const activitySummaryLabel =
    !model.isActivityRunning && isCompleted && model.leafToolCount > 0
      ? `Worked with ${model.leafToolCount} tool${
          model.leafToolCount === 1 ? '' : 's'
        }`
      : undefined;

  const showComputationTime = !model.isActivityRunning && isCompleted;
  const computationTimeMs = useMemo(() => {
    if (!showComputationTime) return undefined;
    return computeComputationTimeMs(model.timingToolCallIds, toolTimings);
  }, [showComputationTime, model.timingToolCallIds, toolTimings]);

  const computationTimeLabel =
    computationTimeMs != null
      ? `Computation Time: ${formatShortDuration(computationTimeMs)}`
      : undefined;

  const onFork = useMemo(
    () =>
      canFork
        ? () => {
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
          }
        : undefined,
    [
      analysisResult,
      canFork,
      chatTurn,
      currentSessionId,
      forkSessionFromMessage,
      forkSourceMessage,
      forkSourceMessageIndex,
    ],
  );

  const regions = useMemo(
    () =>
      createChatTurnRegions({
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
        errorMessage: errorMessage?.error,
        activitySummaryLabel,
        computationTimeMs,
        computationTimeLabel,
        responseText,
        summaryText,
        components,
      }),
    [
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
      errorMessage?.error,
      activitySummaryLabel,
      computationTimeMs,
      computationTimeLabel,
      responseText,
      summaryText,
      components,
    ],
  );

  const turnPresentation = useMemo(
    () => ({
      id: turnId,
      isCompleted,
      hasPrompt: prompt.length > 0,
      hasActivity: model.activity.length > 0,
      hasResponse: responseText.length > 0,
      hasSummary: summaryText.length > 0,
      hoistedOutputCount: model.hoisted.length,
      activity: {
        isRunning: model.isActivityRunning,
        toolCount: model.leafToolCount,
        summaryLabel: activitySummaryLabel,
        computationTimeMs,
        computationTimeLabel,
      },
    }),
    [
      turnId,
      isCompleted,
      prompt.length,
      model.activity.length,
      model.hoisted.length,
      model.isActivityRunning,
      model.leafToolCount,
      responseText.length,
      summaryText.length,
      activitySummaryLabel,
      computationTimeMs,
      computationTimeLabel,
    ],
  );

  return (
    <HoistedRenderersProvider value={excludeList}>
      <Turn turn={turnPresentation} regions={regions} />
    </HoistedRenderersProvider>
  );
};
