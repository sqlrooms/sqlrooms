import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@sqlrooms/ui';
import {ChevronRightIcon} from 'lucide-react';

/**
 * Collapsible overlay for map config and rendering errors.
 * `error` is the detail text; `title` is the always-visible heading.
 * Pass `defaultOpen` for config issues so the message is visible immediately.
 */
export function DeckMapErrorOverlay({
  error,
  title = "Map couldn't be rendered",
  defaultOpen = false,
}: {
  error: Error | string;
  title?: string;
  defaultOpen?: boolean;
}) {
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="max-w-sm rounded-md border border-red-200 bg-red-50/95 p-4 text-sm text-red-700 shadow-sm">
        <Collapsible defaultOpen={defaultOpen}>
          <div className="flex items-start gap-1">
            <span>{title}</span>
            <CollapsibleTrigger
              className="group mt-0.5 shrink-0 rounded p-0.5 hover:bg-red-100"
              aria-label="Show error details"
            >
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <pre className="mt-2 max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {message}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
