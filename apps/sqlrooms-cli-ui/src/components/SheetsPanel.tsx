import React from 'react';
import {Notebook} from '@sqlrooms/notebook';
import {Canvas} from '@sqlrooms/canvas';
import {SheetsTabBar, useCellsStore} from '@sqlrooms/cells';

export const SheetsPanel: React.FC = () => {
  const currentSheet = useCellsStore((s) => {
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
        {currentSheet?.type === 'notebook' && <Notebook />}
        {currentSheet?.type === 'canvas' && <Canvas />}
      </div>
    </div>
  );
};
