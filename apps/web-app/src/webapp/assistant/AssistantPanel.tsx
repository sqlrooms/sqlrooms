import {Button} from '@sqlrooms/ui';
import {Bot, Send, Sparkles} from 'lucide-react';
import {useMemo, useState} from 'react';

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantPanelProps = {
  token: string | null;
  workspaceTitle: string;
  worksheetTitles: string[];
  tableNames: string[];
  onSignInRequired: () => void;
};

export function AssistantPanel({
  token,
  workspaceTitle,
  worksheetTitles,
  tableNames,
  onSignInRequired,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const isBusy = status === 'Thinking';
  const context = useMemo(
    () => ({
      workspaceTitle,
      worksheetTitles,
      tables: tableNames,
    }),
    [tableNames, workspaceTitle, worksheetTitles],
  );

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text || isBusy) return;
    if (!token) {
      onSignInRequired();
      return;
    }

    const nextMessages: AssistantMessage[] = [
      ...messages,
      {role: 'user', content: text},
    ];
    setMessages(nextMessages);
    setPrompt('');
    setStatus('Thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          token,
          messages: nextMessages.slice(-20),
          context,
        }),
      });

      const payload = (await response.json()) as
        | {message: AssistantMessage}
        | {error: string};

      if (!response.ok || 'error' in payload) {
        throw new Error(
          'error' in payload ? payload.error : 'Assistant request failed.',
        );
      }

      setMessages([...nextMessages, payload.message]);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Assistant failed');
    }
  };

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-title">
          <Bot className="size-4" aria-hidden />
          Assistant
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-icon"
          onClick={() => {
            setMessages([]);
            setStatus(null);
          }}
        >
          <Sparkles className="size-4" aria-hidden />
          <span className="sr-only">New assistant thread</span>
        </Button>
      </div>
      <div className="assistant-thread">
        {messages.length === 0 ? (
          <div className="assistant-message">Ask about this workspace.</div>
        ) : (
          messages.map((message, index) => (
            <div
              className={`assistant-message ${message.role === 'user' ? 'user' : ''}`}
              key={`${message.role}:${index}`}
            >
              {message.content}
            </div>
          ))
        )}
        {status ? <div className="assistant-status">{status}</div> : null}
      </div>
      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask a question"
          rows={3}
        />
        <Button type="submit" size="icon" disabled={!prompt.trim() || isBusy}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send message</span>
        </Button>
      </form>
    </aside>
  );
}
