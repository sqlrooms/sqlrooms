import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import {useStoreWithAi, type AiSliceState} from '../AiSlice';

type SessionMessagePart =
  ChatSessionSchema['uiMessages'][number]['parts'][number];
type SessionTextPart = SessionMessagePart & {type: 'text'; text: string};

export type GenerateSessionTitlePromptOptions = Parameters<
  AiSliceState['ai']['sendPrompt']
>[1];

type GenerateSessionTitlePromptArgs = {
  session: ChatSessionSchema;
  userMessages: string[];
};

export type GenerateSessionTitleOptions = {
  /** Maximum generated title length after cleanup. */
  maxTitleLength?: number;
  /** Number of initial user messages to include in the title prompt. */
  maxUserMessages?: number;
  /** Identify titles that are still safe to auto-replace. */
  isDefaultSessionName?: (name: string) => boolean;
  /** Override the prompt sent to the title-generation model. */
  buildPrompt?: (args: GenerateSessionTitlePromptArgs) => string;
  /** Provide model/provider/baseUrl options for the title-generation call. */
  getPromptOptions?: (
    args: GenerateSessionTitlePromptArgs,
  ) =>
    | GenerateSessionTitlePromptOptions
    | Promise<GenerateSessionTitlePromptOptions>;
};

export type GenerateSessionTitleArgs = GenerateSessionTitleOptions & {
  session: ChatSessionSchema;
  sendPrompt: AiSliceState['ai']['sendPrompt'];
  renameSession: AiSliceState['ai']['renameSession'];
};

export type GenerateSessionTitleResult =
  | {
      status: 'renamed';
      title: string;
    }
  | {
      status: 'empty' | 'custom-title' | 'unchanged' | 'blank-generated-title';
      title?: string;
    };

export type UseGenerateSessionTitleOptions = GenerateSessionTitleOptions & {
  /**
   * Turn title generation on or off. Useful while model credentials or app
   * subscription state are still loading.
   */
  enabled?: boolean;
  /** Delay after a new user message before generating a title. */
  delayMs?: number;
  /** Observe failures without breaking the chat UI. */
  onError?: (error: unknown) => void;
};

const DEFAULT_SESSION_NAME_PATTERNS = [
  /^Untitled$/,
  /^Default Session$/,
  /^Session /,
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
];

export function isDefaultGeneratedSessionName(name: string) {
  return DEFAULT_SESSION_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function isTextPart(part: SessionMessagePart): part is SessionTextPart {
  return (
    part.type === 'text' && 'text' in part && typeof part.text === 'string'
  );
}

export function getSessionUserMessageText(session: ChatSessionSchema) {
  return session.uiMessages
    .filter((message) => message.role === 'user')
    .map((message) =>
      message.parts
        .filter(isTextPart)
        .map((part) => part.text)
        .join(' ')
        .trim(),
    )
    .filter((text) => text.length > 0);
}

function buildDefaultTitlePrompt(userMessages: string[]) {
  return `Based on the following user messages from a conversation, generate a concise, descriptive title of 50 characters or fewer that summarizes the main topic.

User messages:
${userMessages.join('\n')}

Return only the title text, without quotes or explanation.`;
}

export function cleanGeneratedSessionTitle(title: string, maxTitleLength = 50) {
  return title
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\n.*/g, '')
    .trim()
    .slice(0, maxTitleLength);
}

export async function generateSessionTitle({
  session,
  sendPrompt,
  renameSession,
  maxTitleLength = 50,
  maxUserMessages = 3,
  isDefaultSessionName = isDefaultGeneratedSessionName,
  buildPrompt,
  getPromptOptions,
}: GenerateSessionTitleArgs): Promise<GenerateSessionTitleResult> {
  if (!isDefaultSessionName(session.name)) {
    return {status: 'custom-title', title: session.name};
  }

  const userMessages = getSessionUserMessageText(session);
  if (userMessages.length === 0) {
    return {status: 'empty'};
  }

  const messagesForPrompt = userMessages.slice(0, maxUserMessages);
  const prompt =
    buildPrompt?.({session, userMessages: messagesForPrompt}) ??
    buildDefaultTitlePrompt(messagesForPrompt);
  const promptOptions = await getPromptOptions?.({
    session,
    userMessages: messagesForPrompt,
  });
  const generatedTitle = await sendPrompt(prompt, {
    systemInstructions:
      'You generate concise, descriptive conversation titles. Return only the title text, nothing else.',
    useTools: false,
    ...promptOptions,
  });
  const title = cleanGeneratedSessionTitle(generatedTitle, maxTitleLength);

  if (!title) {
    return {status: 'blank-generated-title'};
  }
  if (title === session.name) {
    return {status: 'unchanged', title};
  }

  renameSession(session.id, title);
  return {status: 'renamed', title};
}

export function useGenerateSessionTitle({
  enabled = true,
  delayMs = 1000,
  maxTitleLength = 50,
  maxUserMessages = 3,
  isDefaultSessionName = isDefaultGeneratedSessionName,
  buildPrompt,
  getPromptOptions,
  onError,
}: UseGenerateSessionTitleOptions = {}) {
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [currentSessionId, sessions],
  );
  const uiMessagesLength = currentSession?.uiMessages?.length ?? 0;
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const sendPrompt = useStoreWithAi((s) => s.ai.sendPrompt);

  const lastUserMessageCountRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const lastGeneratedTitleRef = useRef('');

  const generateTitle = useCallback(async () => {
    if (!enabled || !currentSession || isGeneratingRef.current) {
      return;
    }

    const userMessages = getSessionUserMessageText(currentSession);
    if (userMessages.length === 0) {
      return;
    }

    const userMessageCount = userMessages.length;
    if (
      userMessageCount === lastUserMessageCountRef.current &&
      currentSession.name !== lastGeneratedTitleRef.current &&
      !isDefaultSessionName(currentSession.name)
    ) {
      return;
    }

    isGeneratingRef.current = true;

    try {
      const result = await generateSessionTitle({
        session: currentSession,
        sendPrompt,
        renameSession,
        maxTitleLength,
        maxUserMessages,
        isDefaultSessionName,
        buildPrompt,
        getPromptOptions,
      });
      if (result.title) {
        lastGeneratedTitleRef.current = result.title;
      }
    } catch (error) {
      onError?.(error);
    } finally {
      isGeneratingRef.current = false;
      lastUserMessageCountRef.current = userMessages.length;
    }
  }, [
    buildPrompt,
    currentSession,
    enabled,
    getPromptOptions,
    isDefaultSessionName,
    maxTitleLength,
    maxUserMessages,
    onError,
    renameSession,
    sendPrompt,
  ]);

  useEffect(() => {
    lastUserMessageCountRef.current = 0;
    lastGeneratedTitleRef.current = '';
    isGeneratingRef.current = false;
  }, [currentSessionId]);

  useEffect(() => {
    if (!enabled || !currentSession || !currentSessionId) {
      return undefined;
    }

    const userMessageCount = getSessionUserMessageText(currentSession).length;

    if (
      userMessageCount > 0 &&
      userMessageCount > lastUserMessageCountRef.current &&
      !isGeneratingRef.current &&
      isDefaultSessionName(currentSession.name)
    ) {
      const timeoutId = setTimeout(() => {
        void generateTitle();
      }, delayMs);

      return () => clearTimeout(timeoutId);
    }

    lastUserMessageCountRef.current = userMessageCount;
    return undefined;
  }, [
    currentSession,
    currentSessionId,
    delayMs,
    enabled,
    generateTitle,
    isDefaultSessionName,
    uiMessagesLength,
  ]);
}
