import type {RoomPanelComponent} from '@sqlrooms/layout';
import {Canvas} from '@sqlrooms/canvas';
import {SheetsTabBar, useCellsStore} from '@sqlrooms/cells';
import {Notebook} from '@sqlrooms/notebook';
import {Button} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {AppBuilderSheet} from './AppBuilderSheet';
import {AssistantDrawer} from './AssistantDrawer';
import {DashboardSheet} from './DashboardSheet';

export const SheetsPanel: RoomPanelComponent = () => {
  const currentSheet = useCellsStore((s) => {
    const id = s.cells.config.currentSheetId;
    return id ? s.cells.config.sheets[id] : undefined;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="bg-muted flex items-center justify-between">
        <SheetsTabBar />
        <div className="flex items-center gap-2 p-1">
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
            <p className="text-muted-foreground text-sm">
              No sheets yet. Create one from the tab bar above.
            </p>
          </div>
        )}
        {currentSheet?.type === 'notebook' && <Notebook />}
        {currentSheet?.type === 'canvas' && <Canvas />}
        {currentSheet?.type === 'app' && <AppBuilderSheet />}
        {currentSheet?.type === 'dashboard' && <DashboardSheet />}
      </div>
    </div>
  );
};
