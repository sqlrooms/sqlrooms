import {Button, cn} from '@sqlrooms/ui';
import {PencilIcon, TrashIcon} from 'lucide-react';
import {FC, useState} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';

type ChatHistoryItemProps = {
  session: AnalysisSessionSchema;
  isActive: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export const ChatHistoryItem: FC<ChatHistoryItemProps> = ({
  session,
  isActive,
  onClick,
  onRename,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const messageCount = session.uiMessages?.length ?? 0;
  const lastMessage = session.uiMessages?.[session.uiMessages.length - 1];

  // Extract text from message parts
  const preview =
    lastMessage?.parts
      ?.filter(
        (part): part is {type: 'text'; text: string} => part.type === 'text',
      )
      .map((part) => part.text)
      .join(' ') ?? '';

  const relativeTime = session.lastOpenedAt
    ? formatTimeRelative(session.lastOpenedAt)
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group relative w-full cursor-pointer rounded-md border p-3 text-left transition-colors',
        isActive
          ? 'border-l-primary bg-primary/5 border-l-4'
          : 'border-border hover:bg-muted',
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-medium">{session.name}</div>
          <div className="text-muted-foreground mb-2 text-xs">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            {relativeTime && ` · ${relativeTime}`}
          </div>
          {preview && (
            <div className="text-muted-foreground truncate text-xs">
              {preview}
            </div>
          )}
        </div>

        {/* Action buttons - visible on hover */}
        <div
          className={cn(
            'flex gap-1 transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            aria-label="Rename chat"
          >
            <PencilIcon className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete chat"
          >
            <TrashIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
