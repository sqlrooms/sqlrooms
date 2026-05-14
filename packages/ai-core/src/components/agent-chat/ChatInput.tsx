import {Button, Textarea} from '@sqlrooms/ui';
import {SendIcon} from 'lucide-react';
import {useCallback, type FC, type KeyboardEvent} from 'react';

export type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
};

/**
 * Bottom-anchored composer: textarea + send/stop button. Submits on Enter
 * (Shift+Enter inserts a newline).
 */
export const ChatInput: FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  placeholder,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) {
          onStop();
          return;
        }
        if (value.trim().length === 0) {
          return;
        }
        onSend(value);
      }
    },
    [isStreaming, onSend, onStop, value],
  );

  return (
    <div className="border-border flex items-end gap-2 border-t p-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="max-h-40 min-h-10 flex-1 resize-none"
        rows={1}
      />
      {isStreaming ? (
        <Button type="button" variant="secondary" size="sm" onClick={onStop}>
          Stop
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => onSend(value)}
          disabled={value.trim().length === 0}
          aria-label="Send"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
