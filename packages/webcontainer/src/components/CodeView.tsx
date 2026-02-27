import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {Button, cn, TabStrip} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useStoreWithWebContainer} from '../WebContainerSlice';

export function CodeView({className}: {className?: string}) {
  const openedFiles = useStoreWithWebContainer(
    (s) => s.webContainer.config.openedFiles,
  );
  const activeFilePath = useStoreWithWebContainer(
    (s) => s.webContainer.config.activeFilePath,
  );
  const setActiveFile = useStoreWithWebContainer(
    (s) => s.webContainer.setActiveFile,
  );
  const closeFile = useStoreWithWebContainer((s) => s.webContainer.closeFile);
  const updateFileContent = useStoreWithWebContainer(
    (s) => s.webContainer.updateFileContent,
  );
  const saveAll = useStoreWithWebContainer(
    (s) => s.webContainer.saveAllOpenFiles,
  );
  const hasDirty = useStoreWithWebContainer((s) =>
    s.webContainer.hasDirtyFiles(),
  );

  const activeFile = useMemo(
    () => openedFiles.find((f) => f.path === activeFilePath) ?? null,
    [openedFiles, activeFilePath],
  );
  const tabs = useMemo(
    () =>
      openedFiles.map((f) => ({
        id: f.path,
        name: f.path.split('/').pop() || f.path,
        dirty: f.dirty,
      })),
    [openedFiles],
  );
  const openTabIds = useMemo(
    () => openedFiles.map((f) => f.path),
    [openedFiles],
  );

  return (
    <div className={cn('flex h-full w-full flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2 p-1">
        <TabStrip
          className="truncate"
          tabs={tabs}
          openTabs={openTabIds}
          selectedTabId={activeFilePath}
          onSelect={setActiveFile}
          onClose={closeFile}
          renderTabTitle={(tab) => (
            <span className="truncate text-sm">
              {tabs.find((t) => t.id === tab.id)?.dirty ? '* ' : ''}
              {tab.name}
            </span>
          )}
        >
          <TabStrip.SearchDropdown />
          <TabStrip.Tabs />
        </TabStrip>
        {hasDirty ? (
          <Button
            size="sm"
            variant="default"
            onClick={saveAll}
            disabled={!activeFile?.dirty}
          >
            {activeFile?.dirty ? 'Save all' : 'Saved'}
          </Button>
        ) : null}
      </div>
      <div className="flex-1">
        <MonacoEditor
          className="h-full w-full"
          language="javascript"
          value={activeFile?.content ?? ''}
          onChange={(v) => {
            if (activeFilePath) {
              updateFileContent(activeFilePath, v ?? '');
            }
          }}
        />
      </div>
    </div>
  );
}
