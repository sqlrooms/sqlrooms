import {type BaseRoomStoreState, useRoomStoreApi} from '@sqlrooms/room-store';
import {Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import type {UIMessage} from 'ai';
import {useCallback, useMemo, useRef} from 'react';
import {type AiSliceState, useStoreWithAi} from '../AiSlice';
import type {AssistantMessageMetadata} from '../types';

const DEFAULT_CONTEXT_WINDOW = 200_000;
const USAGE_WARNING_THRESHOLD = 60;
const USAGE_CRITICAL_THRESHOLD = 80;

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(tokens);
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
}

function buildConversationText(messages: UIMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const text = msg.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as {text: string}).text)
        .join('');
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 6)
    .join('\n\n');
}

function estimateConversationTokens(messages: UIMessage[]): number {
  let totalTokens = 0;

  for (const msg of messages) {
    totalTokens += 4;

    for (const part of msg.parts) {
      if (part.type === 'text') {
        totalTokens += estimateTokenCount((part as {text: string}).text);
        continue;
      }

      if (part.type === 'reasoning') {
        totalTokens += estimateTokenCount((part as {text?: string}).text ?? '');
        continue;
      }

      if (
        typeof part.type === 'string' &&
        (part.type.startsWith('tool-') || part.type === 'dynamic-tool')
      ) {
        const serialized = JSON.stringify(part);
        totalTokens += estimateTokenCount(serialized);
      }
    }
  }

  return totalTokens;
}

function getStrokeColor(percentage: number): string {
  if (percentage > USAGE_CRITICAL_THRESHOLD) return '#ef4444';
  if (percentage > USAGE_WARNING_THRESHOLD) return '#eab308';
  return 'currentColor';
}

/**
 * Sum actual token usage from assistant message metadata.
 * The AI SDK reports cumulative inputTokens + outputTokens per step,
 * which already includes system instructions in the input tokens.
 */
function sumTokenUsageFromMessages(messages: UIMessage[]): number {
  let totalTokens = 0;
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const meta = msg.metadata as AssistantMessageMetadata | undefined;
    if (meta?.tokenUsage) {
      totalTokens += meta.tokenUsage.totalTokens;
    }
  }
  if (totalTokens === 0) {
    totalTokens = estimateConversationTokens(messages);
  }
  return totalTokens;
}

type ContextUsageIndicatorProps = {
  contextWindow?: number;
  modelProvider?: string;
  modelName?: string;
};

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({
  contextWindow = DEFAULT_CONTEXT_WINDOW,
  modelProvider,
  modelName,
}) => {
  const uiMessages = useStoreWithAi((s) => {
    const {currentSessionId, sessions} = s.ai.config;
    return sessions.find((session) => session.id === currentSessionId)
      ?.uiMessages as UIMessage[] | undefined;
  });
  const sendPrompt = useStoreWithAi((s) => s.ai.sendPrompt);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const isSummarizing = useStoreWithAi((s) => s.ai.isSummarizing);
  const setIsSummarizing = useStoreWithAi((s) => s.ai.setIsSummarizing);
  const storeApi = useRoomStoreApi<BaseRoomStoreState & AiSliceState>();

  const summarizeAbortControllerRef = useRef<AbortController | null>(null);

  const totalTokens = useMemo(() => {
    if (!uiMessages) return 0;
    return sumTokenUsageFromMessages(uiMessages);
  }, [uiMessages]);

  const percentage = Math.min((totalTokens / contextWindow) * 100, 100);
  const isClickable = percentage > USAGE_CRITICAL_THRESHOLD && !isSummarizing;

  const handleSummarizeAndContinue = useCallback(async () => {
    if (!uiMessages || uiMessages.length === 0 || isSummarizing) return;

    const abortController = new AbortController();
    summarizeAbortControllerRef.current = abortController;
    setIsSummarizing(true);
    try {
      const conversationText = buildConversationText(uiMessages);
      const summary = await sendPrompt(
        `Summarize the following conversation concisely, preserving key decisions, context, data references, and any pending tasks:\n\n${conversationText}`,
        {
          modelProvider,
          modelName,
          abortSignal: abortController.signal,
          useTools: false,
        },
      );

      createSession();

      const state = storeApi.getState();
      const newSessionId = state.ai.config.currentSessionId;
      if (!newSessionId) return;

      const contextMessage = `Please use the following context from a previous session and only respond "Got it" to this message:\n\n${summary}`;
      state.ai.setPrompt(newSessionId, contextMessage);

      // Wait for SessionChatProvider to mount and register sendMessage for the new session
      const maxWait = 3000;
      const interval = 50;
      let elapsed = 0;
      while (elapsed < maxWait) {
        await new Promise<void>((r) => setTimeout(r, interval));
        elapsed += interval;
        if (storeApi.getState().ai.getChatSendMessage(newSessionId)) break;
      }

      storeApi.getState().ai.startAnalysis(newSessionId);
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
    } finally {
      setIsSummarizing(false);
      summarizeAbortControllerRef.current = null;
    }
  }, [
    uiMessages,
    isSummarizing,
    sendPrompt,
    createSession,
    storeApi,
    modelProvider,
    modelName,
    setIsSummarizing,
  ]);

  if (totalTokens === 0) return null;

  const size = 20;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);
  const strokeColor = getStrokeColor(percentage);

  const tooltipText = `${percentage.toFixed(1)}% · ${formatTokenCount(totalTokens)} / ${formatTokenCount(contextWindow)} context used`;
  const fullTooltip =
    percentage > USAGE_CRITICAL_THRESHOLD
      ? `${tooltipText}\nClick to summarize current conversation and start a new session`
      : tooltipText;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isClickable
              ? 'cursor-pointer hover:bg-red-500/20'
              : 'text-muted-foreground hover:text-foreground'
          } ${isSummarizing ? 'animate-pulse' : ''}`}
          style={
            percentage > USAGE_WARNING_THRESHOLD
              ? {color: strokeColor}
              : undefined
          }
          aria-label={fullTooltip}
          onClick={
            isSummarizing
              ? () => summarizeAbortControllerRef.current?.abort()
              : isClickable
                ? handleSummarizeAndContinue
                : undefined
          }
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={0.2}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">
        {fullTooltip}
      </TooltipContent>
    </Tooltip>
  );
};
