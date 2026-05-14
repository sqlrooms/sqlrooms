import {cn} from '@sqlrooms/ui';
import type {UIMessage, UIMessagePart} from 'ai';
import type {FC} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ToolActivityLine} from './ToolActivityLine';

/**
 * Render a single UI message as a vertical stack of parts (text, reasoning,
 * tool activity). User messages right-align; assistant messages left-align.
 */
export const MessageView: FC<{message: UIMessage}> = ({message}) => {
  const isUser = message.role === 'user';
  const parts = message.parts as UIMessagePart<any, any>[] | undefined;
  if (!parts || parts.length === 0) return null;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1.5',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      {parts.map((part, idx) => (
        <MessagePart
          key={`${message.id}-${idx}`}
          part={part}
          role={message.role}
        />
      ))}
    </div>
  );
};

const MessagePart: FC<{
  part: UIMessagePart<any, any>;
  role: UIMessage['role'];
}> = ({part, role}) => {
  const type = (part as {type?: string}).type ?? '';

  if (type === 'text') {
    return <TextPart text={(part as {text?: string}).text ?? ''} role={role} />;
  }
  if (type === 'reasoning') {
    return <ReasoningPart text={(part as {text?: string}).text ?? ''} />;
  }
  if (type === 'dynamic-tool' || type.startsWith('tool-')) {
    return <ToolActivityLine part={part} />;
  }
  return null;
};

const TextPart: FC<{text: string; role: UIMessage['role']}> = ({
  text,
  role,
}) => {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'rounded-md px-3 py-2 text-sm',
        isUser
          ? 'bg-primary text-primary-foreground max-w-[75%]'
          : 'bg-muted text-foreground max-w-none',
      )}
    >
      {isUser ? (
        <span className="whitespace-pre-wrap">{text}</span>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const ReasoningPart: FC<{text: string}> = ({text}) => {
  if (!text.trim()) return null;
  return (
    <div className="text-muted-foreground max-w-[85%] px-1 text-xs italic">
      {text}
    </div>
  );
};
