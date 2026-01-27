import {cn, Spinner, TabStrip} from '@sqlrooms/ui';
import {HistoryIcon, PencilIcon, TrashIcon} from 'lucide-react';
import {useCallback, useMemo, useState} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {DeleteSessionDialog, RenameSessionDialog} from './session';

/**
 * Main component for managing AI sessions.
 * Uses TabStrip for session management with dropdown for switching sessions.
 *
 * @example
 * ```tsx
 * <SessionControls className="p-4 border-b">
 *   <Button>Custom Button</Button>
 * </SessionControls>
 * ```
 */
export const SessionControls: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({className, children}) => {
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const getIsSessionRunning = useStoreWithAi((s) => s.ai.getIsRunning);
  const switchSession = useStoreWithAi((s) => s.ai.switchSession);
  const createSession = useStoreWithAi((s) => s.ai.createSession);
  const renameSession = useStoreWithAi((s) => s.ai.renameSession);
  const deleteSession = useStoreWithAi((s) => s.ai.deleteSession);
  const openTabs = useStoreWithAi((s) => s.ai.config.openSessionTabs);
  const setOpenTabs = useStoreWithAi((s) => s.ai.setOpenSessionTabs);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [sessionToRename, setSessionToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Convert sessions to TabDescriptor format
  const tabs = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        name: s.name,
        lastOpenedAt: s.lastOpenedAt,
      })),
    [sessions],
  );

  const handleClose = useCallback(
    (sessionId: string) => {
      // Don't close if it's the only open tab
      if (!openTabs || openTabs.length <= 1) return;

      const remaining = openTabs.filter((id) => id !== sessionId);
      setOpenTabs(remaining);

      // If closing the current session, switch to another open one
      if (sessionId === currentSessionId && remaining.length > 0) {
        switchSession(remaining[0]!);
      }
    },
    [openTabs, currentSessionId, switchSession, setOpenTabs],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      // If session is empty (no messages), delete without confirmation
      if (!session?.uiMessages?.length) {
        deleteSession(sessionId);
      } else {
        setSessionToDelete(sessionId);
      }
    },
    [sessions, deleteSession],
  );

  const handleConfirmDelete = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  }, [sessionToDelete, deleteSession]);

  const handleCloseDeleteDialog = useCallback(() => {
    setSessionToDelete(null);
  }, []);

  const handleRenameRequest = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        setSessionToRename({id: sessionId, name: session.name});
      }
    },
    [sessions],
  );

  const handleFinishRename = useCallback(
    (newName: string) => {
      if (sessionToRename) {
        renameSession(sessionToRename.id, newName);
      }
      setSessionToRename(null);
    },
    [sessionToRename, renameSession],
  );

  // Memoize render functions to prevent unnecessary re-renders
  const renderTabLabel = useCallback(
    (tab: {id: string; name: string}) => (
      <div className="flex items-center gap-2">
        {getIsSessionRunning(tab.id) && (
          <Spinner className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
        )}
        <span className="truncate">{tab.name}</span>
      </div>
    ),
    [getIsSessionRunning],
  );

  const renderTabMenu = useCallback(
    (tab: {id: string; name: string}) => (
      <>
        <TabStrip.MenuItem onClick={() => handleRenameRequest(tab.id)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </TabStrip.MenuItem>
        {sessions.length > 1 && (
          <>
            <TabStrip.MenuSeparator />
            <TabStrip.MenuItem
              variant="destructive"
              onClick={() => handleDelete(tab.id)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete
            </TabStrip.MenuItem>
          </>
        )}
      </>
    ),
    [handleRenameRequest, handleDelete, sessions.length],
  );

  const renderSearchItemActions = useCallback(
    (tab: {id: string; name: string}) => (
      <>
        <TabStrip.SearchItemAction
          icon={<PencilIcon className="h-3 w-3" />}
          aria-label={`Rename ${tab.name}`}
          onClick={() => handleRenameRequest(tab.id)}
        />
        {sessions.length > 1 && (
          <TabStrip.SearchItemAction
            icon={<TrashIcon className="h-3 w-3" />}
            aria-label={`Delete ${tab.name}`}
            onClick={() => handleDelete(tab.id)}
          />
        )}
      </>
    ),
    [handleRenameRequest, handleDelete, sessions.length],
  );

  return (
    <>
      <div
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-2 overflow-visible',
          className,
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <TabStrip
            className="bg-background"
            tabs={tabs}
            preventCloseLastTab
            openTabs={openTabs}
            selectedTabId={currentSessionId}
            onClose={handleClose}
            onOpenTabsChange={setOpenTabs}
            onSelect={switchSession}
            onCreate={() => createSession()}
            onRename={renameSession}
            renderTabLabel={renderTabLabel}
            renderTabMenu={renderTabMenu}
            renderSearchItemActions={renderSearchItemActions}
          >
            <TabStrip.SearchDropdown
              triggerIcon={<HistoryIcon className="h-4 w-4" />}
              tooltip="Session history"
              sortSearchItems="recent"
              getTabLastOpenedAt={(tab) =>
                tab.lastOpenedAt as number | undefined
              }
            />
            <TabStrip.Tabs tabClassName="rounded-md data-[state=active]:bg-muted" />
            <TabStrip.NewButton tooltip="New session" />
          </TabStrip>
        </div>

        {children}
      </div>

      <DeleteSessionDialog
        isOpen={sessionToDelete !== null}
        onClose={handleCloseDeleteDialog}
        onDelete={handleConfirmDelete}
      />
      <RenameSessionDialog
        isOpen={sessionToRename !== null}
        onClose={() => setSessionToRename(null)}
        initialName={sessionToRename?.name ?? ''}
        onRename={handleFinishRename}
      />
    </>
  );
};
