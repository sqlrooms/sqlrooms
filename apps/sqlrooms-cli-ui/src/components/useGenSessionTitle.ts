import {useCallback, useEffect, useRef} from 'react';
import {useRoomStore} from '../store';

const DEFAULT_SESSION_NAME_PATTERNS = [
  /^Untitled$/,
  /^Default Session$/,
  /^Session /,
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
];

export function isDefaultAssistantSessionName(name: string) {
  return DEFAULT_SESSION_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function useGenSessionTitle() {
  const currentSessionId = useRoomStore((s) => s.ai.config.currentSessionId);
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const uiMessagesLength = useRoomStore(
    (s) => s.ai.getCurrentSession()?.uiMessages?.length ?? 0,
  );
  const renameSession = useRoomStore((s) => s.ai.renameSession);
  const sendPrompt = useRoomStore((s) => s.ai.sendPrompt);

  const lastUserMessageCountRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const lastGeneratedTitleRef = useRef('');

  const extractUserMessageText = useCallback(() => {
    return (currentSession?.uiMessages ?? [])
      .filter((message) => message.role === 'user')
      .map((message) =>
        message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join(' ')
          .trim(),
      )
      .filter((text) => text.length > 0);
  }, [currentSession?.uiMessages]);

  const generateTitle = useCallback(async () => {
    if (!currentSession || isGeneratingRef.current) {
      return;
    }

    const userMessages = extractUserMessageText();
    if (userMessages.length === 0) {
      return;
    }

    const userMessageCount = userMessages.length;
    if (
      userMessageCount === lastUserMessageCountRef.current &&
      currentSession.name !== lastGeneratedTitleRef.current &&
      !isDefaultAssistantSessionName(currentSession.name)
    ) {
      return;
    }

    isGeneratingRef.current = true;

    try {
      const messagesText = userMessages.slice(0, 3).join('\n');
      const generatedTitle = await sendPrompt(
        `Based on the following user messages from a conversation, generate a concise, descriptive title of 50 characters or fewer that summarizes the main topic.

User messages:
${messagesText}

Return only the title text, without quotes or explanation.`,
        {
          systemInstructions:
            'You generate concise, descriptive conversation titles. Return only the title text, nothing else.',
          useTools: false,
        },
      );

      const title = generatedTitle
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\n.*/g, '')
        .trim()
        .slice(0, 50);

      if (title && title !== currentSession.name) {
        renameSession(currentSession.id, title);
        lastGeneratedTitleRef.current = title;
      }
    } catch (error) {
      console.error('Error generating session title:', error);
    } finally {
      isGeneratingRef.current = false;
      lastUserMessageCountRef.current = userMessages.length;
    }
  }, [currentSession, extractUserMessageText, renameSession, sendPrompt]);

  useEffect(() => {
    lastUserMessageCountRef.current = 0;
    lastGeneratedTitleRef.current = '';
    isGeneratingRef.current = false;
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSession || !currentSessionId) {
      return undefined;
    }

    const userMessageCount = extractUserMessageText().length;

    if (
      userMessageCount > 0 &&
      userMessageCount > lastUserMessageCountRef.current &&
      !isGeneratingRef.current &&
      isDefaultAssistantSessionName(currentSession.name)
    ) {
      const timeoutId = window.setTimeout(() => {
        void generateTitle();
      }, 1000);

      return () => window.clearTimeout(timeoutId);
    }

    lastUserMessageCountRef.current = userMessageCount;
    return undefined;
  }, [
    currentSession,
    currentSessionId,
    extractUserMessageText,
    generateTitle,
    uiMessagesLength,
  ]);
}
