import {createContext, useContext} from 'react';
import {DockingContextValue} from './docking-types';

export const DockingContext = createContext<DockingContextValue | null>(null);

export function useDockingContext(): DockingContextValue {
  const context = useContext(DockingContext);

  if (!context) {
    throw new Error('useDockingContext must be used within DockingProvider');
  }

  return context;
}
