import type {UIMessage} from 'ai';
import type {AnalysisResultSchema, UIMessagePart} from '@sqlrooms/ai-config';

export type ChatRequestErrorMessage = {
  error: string;
};

export type ChatMessageMetadata = {
  sqlrooms?: {
    errorMessage?: ChatRequestErrorMessage;
  };
};

export type ChatTurn = {
  id: string;
  prompt: string;
  userMessage: UIMessage;
  assistantMessages: UIMessage[];
  isCompleted: boolean;
  errorMessage?: ChatRequestErrorMessage;
};

export function getMessageText(message: UIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as {text: string}).text)
    .join('');
}

export function getChatRequestErrorMessage(
  message: UIMessage | undefined,
): ChatRequestErrorMessage | undefined {
  const metadata = message?.metadata as ChatMessageMetadata | undefined;
  const error = metadata?.sqlrooms?.errorMessage?.error;
  return typeof error === 'string' ? {error} : undefined;
}

export function setChatRequestErrorMessage(
  message: UIMessage,
  errorMessage: ChatRequestErrorMessage,
) {
  const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
  message.metadata = {
    ...metadata,
    sqlrooms: {
      ...(metadata.sqlrooms ?? {}),
      errorMessage,
    },
  };
}

function isPartComplete(part: UIMessagePart): boolean {
  if (
    (part.type === 'text' || part.type === 'reasoning') &&
    (part as {state?: string}).state === 'streaming'
  ) {
    return false;
  }

  if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
    const state = (part as {state?: string}).state;
    return (
      state === 'output-available' ||
      state === 'output-error' ||
      state === 'output-denied'
    );
  }

  return true;
}

function areAssistantMessagesComplete(messages: UIMessage[]): boolean {
  return messages.every((message) =>
    (message.parts as UIMessagePart[]).every(isPartComplete),
  );
}

export function getChatTurnsFromUiMessages(
  uiMessages: UIMessage[] | undefined,
  options: {isRunning?: boolean} = {},
): ChatTurn[] {
  if (!uiMessages?.length) return [];

  const turns: ChatTurn[] = [];

  for (let index = 0; index < uiMessages.length; index++) {
    const message = uiMessages[index];
    if (!message || message.role !== 'user') continue;

    const assistantMessages: UIMessage[] = [];
    let nextIndex = index + 1;
    while (nextIndex < uiMessages.length) {
      const nextMessage = uiMessages[nextIndex];
      if (!nextMessage || nextMessage.role === 'user') break;
      if (nextMessage.role === 'assistant') assistantMessages.push(nextMessage);
      nextIndex++;
    }

    const isLastTurn = !uiMessages
      .slice(nextIndex)
      .some((candidate) => candidate.role === 'user');
    const errorMessage = getChatRequestErrorMessage(message);
    turns.push({
      id: message.id,
      prompt: getMessageText(message),
      userMessage: message,
      assistantMessages,
      isCompleted:
        !!errorMessage ||
        (assistantMessages.length > 0 &&
          areAssistantMessagesComplete(assistantMessages) &&
          !(options.isRunning && isLastTurn)),
      errorMessage,
    });
  }

  return turns;
}

export function getAnalysisResultsFromUiMessages(
  uiMessages: UIMessage[] | undefined,
  options: {isRunning?: boolean} = {},
): AnalysisResultSchema[] {
  return getChatTurnsFromUiMessages(uiMessages, options).map((turn) => ({
    id: turn.id,
    prompt: turn.prompt,
    isCompleted: turn.isCompleted,
    ...(turn.errorMessage ? {errorMessage: turn.errorMessage} : {}),
  }));
}
