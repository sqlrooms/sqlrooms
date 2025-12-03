import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {Button, Tabs, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from '../store/store';

export const CodeView = () => {
  const openedFiles = useRoomStore((s) => s.webContainer.config.openedFiles);
  const activeFilePath = useRoomStore(
    (s) => s.webContainer.config.activeFilePath,
  );
  const setActiveFile = useRoomStore((s) => s.webContainer.setActiveFile);
  const updateFileContent = useRoomStore(
    (s) => s.webContainer.updateFileContent,
  );
  const saveAll = useRoomStore((s) => s.webContainer.saveAllOpenFiles);
  const hasDirty = useRoomStore((s) => s.webContainer.hasDirtyFiles());

  const activeFile = useMemo(
    () => openedFiles.find((f) => f.path === activeFilePath) ?? null,
    [openedFiles, activeFilePath],
  );

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 p-1">
        <Tabs
          className="truncate"
          value={activeFilePath ?? ''}
          onValueChange={setActiveFile}
        >
          <TabsList>
            {openedFiles.map((f) => (
              <TabsTrigger key={f.path} value={f.path}>
                {f.dirty ? '* ' : ''}
                {f.path.split('/').pop()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
};
