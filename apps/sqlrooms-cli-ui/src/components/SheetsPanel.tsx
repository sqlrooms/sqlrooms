import {Canvas} from '@sqlrooms/canvas';
import {SheetsTabBar, useCellsStore} from '@sqlrooms/cells';
import {Notebook} from '@sqlrooms/notebook';
import {Button, cn} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import React from 'react';
import {AssistantDrawer} from './AssistantDrawer';

export const SheetsPanel: React.FC<{className?: string}> = ({className}) => {
  const currentSheet = useCellsStore((s) => {
    const id = s.cells.config.currentSheetId;
    return id ? s.cells.config.sheets[id] : undefined;
  });

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center justify-between bg-muted">
        <SheetsTabBar />
        <div className="p-1">
          <AssistantDrawer>
            <Button size="icon" className="h-7 w-7 rounded-full">
              <SparklesIcon />
            </Button>
          </AssistantDrawer>
        </div>
      </div>
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
