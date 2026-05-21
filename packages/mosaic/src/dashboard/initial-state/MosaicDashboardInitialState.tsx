import {useState} from 'react';
import type {OnStartDashboard} from '../action-types';
import {BuildDashboardWithAIPanel} from './BuildDashboardWithAIPanel';
import {BuildDashboardManuallyPanel} from './BuildDashboardManuallyPanel';

export interface MosaicDashboardInitialStateProps {
  onStart?: OnStartDashboard;
}

export const MosaicDashboardInitialState: React.FC<
  MosaicDashboardInitialStateProps
> = ({onStart}) => {
  const [isStarting, setIsStarting] = useState(false);

  return (
    <div className="m-4 flex min-h-[240px] items-center justify-center rounded-md p-8">
      <div className="flex w-full max-w-4xl flex-col gap-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Create Your Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Choose how you&apos;d like to start
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <BuildDashboardWithAIPanel
            onStart={onStart}
            isStarting={isStarting}
            onStartingChange={setIsStarting}
          />
          <BuildDashboardManuallyPanel
            isStarting={isStarting}
            onStartingChange={setIsStarting}
          />
        </div>
      </div>
    </div>
  );
};
