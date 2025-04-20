import React, {PropsWithChildren} from 'react';
import {Button, cn} from '@sqlrooms/ui';
import {BookOpenIcon} from 'lucide-react';

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
}>;

export const SqlEditorHeader: React.FC<SqlEditorHeaderProps> = ({
  className,
  title,
  showDocs,
  documentationPanel,
  onToggleDocs,
  children,
}) => {
  const buttonContent = (
    <div className="flex items-center gap-2">
      <BookOpenIcon />
      <span className="text-xs">SQL reference</span>
    </div>
  );

  return (
    <div className={cn('flex w-full items-center gap-2 px-2 py-1', className)}>
      {title && <h2 className="text-md ml-1 font-semibold">{title}</h2>}
      {children}
      <div className="flex-grow" />
      {documentationPanel ? (
        <Button
          size="sm"
          variant={showDocs ? 'secondary' : 'outline'}
          onClick={() => onToggleDocs?.(!showDocs)}
        >
          {buttonContent}
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <a
            href="https://duckdb.org/docs/sql/introduction"
            target="_blank"
            rel="noreferrer"
          >
            {buttonContent}
          </a>
        </Button>
      )}
    </div>
  );
};
