import {Button, cn} from '@sqlrooms/ui';
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
}>;

export const SqlEditorHeader: React.FC<SqlEditorHeaderProps> = ({
  className,
  title,
  showDocs,
  documentationPanel,
  onToggleDocs,
  children,
}) => {
  return (
    <div className={cn('flex w-full items-center gap-2 px-2 py-1', className)}>
      {title && <h2 className="text-md ml-1 font-semibold">{title}</h2>}
      {children}
      <div className="grow" />
      {documentationPanel ? (
        <Button
          size="sm"
          variant={showDocs ? 'secondary' : 'outline'}
          onClick={() => onToggleDocs?.(!showDocs)}
        >
          <SqlReferenceButtonContent />
        </Button>
      ) : (
        <SqlReferenceButton />
      )}
    </div>
  );
};
