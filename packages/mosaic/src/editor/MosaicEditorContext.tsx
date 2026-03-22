import {createContext, useContext} from 'react';
import {MosaicEditorContextValue} from './types';

export const MosaicEditorContext =
  createContext<MosaicEditorContextValue | null>(null);

/**
 * Hook to access the Mosaic editor context.
 * Must be used within a MosaicChart.Container component.
 */
export function useMosaicEditorContext(): MosaicEditorContextValue {
  const ctx = useContext(MosaicEditorContext);
  if (!ctx) {
    throw new Error(
      'useMosaicEditorContext must be used within MosaicChart.Container',
    );
  }
  return ctx;
}
