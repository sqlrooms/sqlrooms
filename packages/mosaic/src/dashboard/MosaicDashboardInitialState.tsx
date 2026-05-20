import {Button, Textarea} from '@sqlrooms/ui';
import {useCallback, useState} from 'react';
import {TableSelector} from '../chart-builders/TableSelector';
import {Field} from '../chart-builders/Field';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

export interface MosaicDashboardInitialStateProps {
  onStart?: (tableName: string, prompt?: string) => void | Promise<void>;
}

export const MosaicDashboardInitialState: React.FC<
  MosaicDashboardInitialStateProps
> = ({onStart}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const [localTableName, setLocalTableName] = useState<string | undefined>(
    undefined,
  );
  const [prompt, setPrompt] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = useCallback(async () => {
    if (!localTableName) return;

    setIsStarting(true);
    try {
      // Call custom onStart handler if provided (for AI agent integration)
      if (onStart) {
        await onStart(localTableName, prompt || undefined);
      }
      // Set the selected table after AI processing (or immediately if no handler)
      setSelectedTable(dashboardId, localTableName);
    } finally {
      setIsStarting(false);
    }
  }, [localTableName, prompt, dashboardId, setSelectedTable, onStart]);

  return (
    <div className="m-4 flex min-h-[240px] items-center justify-center rounded-md border border-dashed p-8">
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">
          Select a table to start building your dashboard
        </p>
        <div className="w-full max-w-md space-y-3">
          <Field label="Table" required>
            <TableSelector
              value={localTableName}
              onChange={setLocalTableName}
              placeholder="Select table…"
            />
          </Field>
          <Field label="What would you like to analyze?">
            <div className="space-y-1">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Show me sales trends over time, identify top customers, analyze seasonal patterns..."
                rows={3}
                className="resize-none"
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (e.metaKey || e.ctrlKey) &&
                    localTableName
                  ) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
              />
              <p className="text-muted-foreground text-xs">
                Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                to start
              </p>
            </div>
          </Field>
          <Button
            className="w-full"
            disabled={!localTableName || isStarting}
            onClick={handleStart}
          >
            {isStarting ? 'Starting...' : 'Start'}
          </Button>
        </div>
      </div>
    </div>
  );
};
