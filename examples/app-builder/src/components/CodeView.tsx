import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {Button, Tabs, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from '../store/store';

export const CodeView = () => {
  const openedFiles = useRoomStore((s) => s.wc.openedFiles);
  const activeFilePath = useRoomStore((s) => s.wc.activeFilePath);
  const setActiveFile = useRoomStore((s) => s.wc.setActiveFile);
  const updateFileContent = useRoomStore((s) => s.wc.updateFileContent);
  const saveAll = useRoomStore((s) => s.wc.saveAllOpenFiles);

  const activeFile = useMemo(
    () => openedFiles.find((f) => f.path === activeFilePath) ?? null,
    [openedFiles, activeFilePath],
  );

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 p-1">
        <Tabs value={activeFilePath ?? undefined} onValueChange={setActiveFile}>
          <TabsList>
            {openedFiles.map((f) => (
              <TabsTrigger key={f.path} value={f.path}>
                {f.dirty ? '* ' : ''}
                {f.path.split('/').pop()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" variant="secondary" onClick={saveAll}>
          Save
        </Button>
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
