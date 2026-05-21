import {createContext, useContext} from 'react';
import type {MosaicDashboardInitialStateProps} from './initial-state/MosaicDashboardInitialState';

export type MosaicDashboardContextValue = {
  dashboardId: string;
  builderOpen: boolean;
  canCreateChart: boolean;
  openBuilder: () => void;
  closeBuilder: () => void;
  setBuilderOpen: (open: boolean) => void;
  addDefaultChart: () => void;
  onStart?: MosaicDashboardInitialStateProps['onStart'];
};

export const MosaicDashboardContext =
  createContext<MosaicDashboardContextValue | null>(null);

export function useMosaicDashboardContext(): MosaicDashboardContextValue {
  const ctx = useContext(MosaicDashboardContext);
  if (!ctx) {
    throw new Error(
      'MosaicDashboard compound components must be rendered inside <MosaicDashboard> or <MosaicDashboard.Root>.',
    );
  }
  return ctx;
}
