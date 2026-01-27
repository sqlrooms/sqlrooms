import React from 'react';
import {cn} from '@sqlrooms/ui';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {QueryEditorPanelActions} from './QueryEditorPanelActions';
import {QueryEditorPanelEditor} from './QueryEditorPanelEditor';
import {QueryEditorPanelTabsList} from './QueryEditorPanelTabsList';

export interface QueryEditorPanelProps {
  /** Custom class name for styling */
  className?: string;
}

export const QueryEditorPanel: React.FC<QueryEditorPanelProps> = ({
  className,
}) => {
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );
  const openTabs = useStoreWithSqlEditor((s) => s.sqlEditor.config.openTabs);

  const isSelectedOpen = openTabs.includes(selectedQueryId);

  // Monaco editor virtualization:
  // Monaco editors are expensive to keep mounted (memory, undo stack, etc).
  // We keep a small "keep-alive" set to reduce flashing while bounding cost.
  const MAX_MOUNTED_EDITORS = 5;
  const [mountedIds, setMountedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!isSelectedOpen) {
      setMountedIds([]);
      return;
    }

    const selectedIndex = openTabs.indexOf(selectedQueryId);
    const prevId = selectedIndex > 0 ? openTabs[selectedIndex - 1] : undefined;
    const nextId =
      selectedIndex >= 0 && selectedIndex < openTabs.length - 1
        ? openTabs[selectedIndex + 1]
        : undefined;

    const nextMounted = [selectedQueryId, prevId, nextId, ...mountedIds].filter(
      (id): id is string => Boolean(id) && openTabs.includes(id as string),
    );

    // Deduplicate while preserving order.
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const id of nextMounted) {
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(id);
      if (deduped.length >= MAX_MOUNTED_EDITORS) break;
    }

    setMountedIds(deduped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueryId, openTabs.join('|'), isSelectedOpen]);

  // Always include the selected tab id in the render set (prevents blank/flash on tab switch).
  const mountedIdsToRender = isSelectedOpen
    ? [selectedQueryId, ...mountedIds]
    : [];
  const mountedIdSet = React.useMemo(
    () => new Set(mountedIdsToRender),
    [mountedIdsToRender],
  );

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        // this is for Monaco's completion menu to not being cut off
        'overflow-visible',
        className,
      )}
    >
      <div className="border-border flex items-center gap-4 border-b px-2 pt-1">
        <QueryEditorPanelTabsList />
        <div className="flex-1" />
        <QueryEditorPanelActions />
      </div>
      {isSelectedOpen ? (
        <div className="bg-background h-full w-full py-1">
          <div className="relative h-full flex-grow">
            <div className="absolute inset-0">
              {openTabs
                .filter((id) => mountedIdSet.has(id))
                .map((queryId) => {
                  const isActive = queryId === selectedQueryId;
                  return (
                    <div
                      key={queryId}
                      className={cn(
                        'absolute inset-0',
                        isActive
                          ? 'opacity-100'
                          : 'pointer-events-none opacity-0',
                      )}
                      aria-hidden={!isActive}
                      ref={(el) => {
                        if (!el) return;
                        (el as HTMLDivElement & {inert: boolean}).inert =
                          !isActive;
                      }}
                    >
                      <QueryEditorPanelEditor queryId={queryId} />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          No open queries
        </div>
      )}
    </div>
  );
};
