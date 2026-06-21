import {useChat} from '@ai-sdk/react';
import type {AbstractChat, ChatStatus, ToolLoopAgent, UIMessage} from 'ai';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from 'react';
import {useLocalAgentChatTransport} from '../hooks/useLocalAgentChatTransport';
import type {ToolRenderBehavior} from './FlatAgentRenderer';

export type SessionChatRuntime = {
  mode: 'session';
};

export type LocalAgentChatRuntime = {
  mode: 'local-agent';
  messages: UIMessage[];
  status: ChatStatus;
  isStreaming: boolean;
  prompt: string;
  setPrompt: (value: string) => void;
  sendPrompt: (value?: string) => void;
  stop: AbstractChat<UIMessage>['stop'];
  initialSuggestions: readonly string[];
  suggestionsVisible: boolean;
  setSuggestionsVisible: (visible: boolean) => void;
};

export type ChatRuntime = SessionChatRuntime | LocalAgentChatRuntime;

export type LocalAgentChatRootProps = PropsWithChildren<{
  agent: ToolLoopAgent<any, any, any>;
  initialMessages?: UIMessage[];
  initialSuggestions?: readonly string[];
  onMessagesChange?: (messages: UIMessage[]) => void;
  toolRenderBehavior?: ToolRenderBehavior;
}>;

const SESSION_RUNTIME: SessionChatRuntime = {mode: 'session'};

const ChatRuntimeContext = createContext<ChatRuntime>(SESSION_RUNTIME);

export const SessionChatRuntimeProvider: FC<PropsWithChildren> = ({
  children,
}) => (
  <ChatRuntimeContext.Provider value={SESSION_RUNTIME}>
    {children}
  </ChatRuntimeContext.Provider>
);

export const LocalAgentChatRuntimeProvider: FC<LocalAgentChatRootProps> = ({
  agent,
  initialMessages,
  initialSuggestions,
  onMessagesChange,
  children,
}) => {
  const transport = useLocalAgentChatTransport(agent);
  const {messages, sendMessage, status, stop} = useChat({
    transport,
    messages: initialMessages ?? [],
  });
  const [prompt, setPrompt] = useState('');
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const isStreaming = status === 'streaming' || status === 'submitted';

  useMessagesObserver(messages, onMessagesChange);

  const sendPrompt = useCallback(
    (value?: string) => {
      const text = (value ?? prompt).trim();
      if (!text || isStreaming) return;
      void sendMessage({text});
      setPrompt('');
    },
    [isStreaming, prompt, sendMessage],
  );

  const runtime: LocalAgentChatRuntime = {
    mode: 'local-agent',
    messages,
    status,
    isStreaming,
    prompt,
    setPrompt,
    sendPrompt,
    stop,
    initialSuggestions: initialSuggestions ?? [],
    suggestionsVisible,
    setSuggestionsVisible,
  };

  return (
    <ChatRuntimeContext.Provider value={runtime}>
      {children}
    </ChatRuntimeContext.Provider>
  );
};

export function useChatRuntime(): ChatRuntime {
  return useContext(ChatRuntimeContext);
}

function useMessagesObserver(
  messages: UIMessage[],
  onMessagesChange: ((messages: UIMessage[]) => void) | undefined,
): void {
  const ref = useRef(onMessagesChange);
  useEffect(() => {
    ref.current = onMessagesChange;
  }, [onMessagesChange]);
  useEffect(() => {
    ref.current?.(messages);
  }, [messages]);
}
