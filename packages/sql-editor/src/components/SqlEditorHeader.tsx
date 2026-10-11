import {Button, cn} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import React, {PropsWithChildren} from 'react';
import {
  SqlReferenceButton,
  SqlReferenceButtonContent,
} from './SqlReferenceButton';

export type SqlEditorHeaderProps = PropsWithChildren<{
  /** Custom class name for styling */
  className?: string;
  /** The title of the SQL editor */
  title?: string;
  /** Whether to show the documentation panel */
  showDocs?: boolean;
  /** Optional documentation panel component */
  documentationPanel?: React.ReactNode;
  /** Callback when the documentation visibility is toggled */
  onToggleDocs?: (show: boolean) => void;
  /** Optional callback for closing the editor surface */
  onClose?: () => void;
}>;

export const SqlEditorHeader: React.FC<SqlEditorHeaderProps> = ({
  className,
  title,
  showDocs,
  documentationPanel,
  onToggleDocs,
  onClose,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex min-h-10 w-full min-w-0 items-center gap-2 px-2 py-1',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {title && (
          <h2 className="ml-1 min-w-0 truncate text-base font-semibold">
            {title}
          </h2>
        )}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {documentationPanel ? (
          <Button
            size="sm"
            variant={showDocs ? 'secondary' : 'outline'}
            className="shrink-0"
            onClick={() => onToggleDocs?.(!showDocs)}
          >
            <SqlReferenceButtonContent />
          </Button>
        ) : (
          <SqlReferenceButton className="shrink-0" />
        )}
        {onClose && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            aria-label="Close SQL editor"
          >
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
};
