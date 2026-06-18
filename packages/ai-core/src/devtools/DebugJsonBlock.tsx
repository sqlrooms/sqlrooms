import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CopyButton,
  cn,
} from '@sqlrooms/ui';
import {ChevronRightIcon} from 'lucide-react';
import React, {useMemo} from 'react';

export type DebugJsonBlockProps = {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
  className?: string;
  editorClassName?: string;
};

function stringifyDebugValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const DebugJsonBlock: React.FC<DebugJsonBlockProps> = ({
  title,
  value,
  defaultOpen = false,
  className,
  editorClassName,
}) => {
  const text = useMemo(() => stringifyDebugValue(value), [value]);

  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('w-full', className)}>
      <div className="border-border bg-muted/30 rounded-md border">
        <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium">
            <ChevronRightIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            <span className="truncate">{title}</span>
          </CollapsibleTrigger>
          <CopyButton
            text={text}
            size="icon"
            className="h-6 w-6 shrink-0"
            tooltipLabel={`Copy ${title}`}
          />
        </div>
        <CollapsibleContent>
          <div className="border-border/70 border-t">
            <JsonCodeMirrorEditor
              value={text}
              readOnly
              hideGutter
              options={{
                lineNumbers: false,
                lineWrapping: true,
                foldGutter: false,
                autocompletion: false,
              }}
              className={cn('h-40 text-xs', editorClassName)}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
