import React from 'react';
import {Button, cn} from '@sqlrooms/ui';
import {BookOpenIcon} from 'lucide-react';

export const SqlReferenceButton: React.FC<{
  className?: string;
  text?: string;
  icon?: React.ReactNode;
}> = ({className, text, icon}) => {
  return (
    <Button asChild size="sm" variant="outline" className={cn(className)}>
      <a
        href="https://duckdb.org/docs/sql/introduction"
        target="_blank"
        rel="noreferrer"
      >
        <SqlReferenceButtonContent text={text} icon={icon} />
      </a>
    </Button>
  );
};

export const SqlReferenceButtonContent: React.FC<{
  className?: string;
  text?: string;
  icon?: React.ReactNode;
}> = ({className, text = 'SQL reference', icon = <BookOpenIcon />}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {icon}
      <span className="text-xs">{text}</span>
    </div>
  );
};
