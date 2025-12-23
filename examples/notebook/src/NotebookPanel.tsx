import React from 'react';
import {Notebook} from '@sqlrooms/notebook';
import {Canvas} from '@sqlrooms/canvas';
import {SheetsTabBar} from '@sqlrooms/cells';
import {useRoomStore} from './store';

export const NotebookPanel: React.FC = () => {
  const currentSheet = useRoomStore((s) => {
    const id = s.cells.config.currentSheetId;
    return id ? s.cells.config.sheets[id] : undefined;
  });

  return (
    <div className="flex h-full flex-col">
      <SheetsTabBar />
      <div className="min-h-0 flex-1">
        {!currentSheet && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">
              No sheets yet. Create one from the tab bar above.
            </p>
          </div>
        )}
        <Notebook />
      </div>
    </div>
  );
};
