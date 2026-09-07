import {createContext, useContext} from 'react';

const RenderNestedHoistedOutputsContext = createContext(true);

/**
 * Controls whether an agent activity renderer owns its nested rich outputs.
 * Turn timelines enable this; decomposed activity regions disable it because
 * the turn-level hoisted-output region owns those outputs instead.
 */
export const RenderNestedHoistedOutputsProvider =
  RenderNestedHoistedOutputsContext.Provider;

/** Whether nested rich outputs should render inside the current agent tree. */
export function useRenderNestedHoistedOutputs(): boolean {
  return useContext(RenderNestedHoistedOutputsContext);
}
