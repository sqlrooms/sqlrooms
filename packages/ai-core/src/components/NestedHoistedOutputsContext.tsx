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

const InsideHoistedOutputContext = createContext(false);

/**
 * Marks a hoisted output. A hoisted slot shows the call's result only: the
 * turn draws every sub-agent's steps in its activity and hoists their outputs
 * alongside, so an agent tree that a hoisted renderer embeds draws nothing.
 */
export const InsideHoistedOutputProvider = InsideHoistedOutputContext.Provider;

/** Whether the current subtree is a hoisted output. */
export function useIsInsideHoistedOutput(): boolean {
  return useContext(InsideHoistedOutputContext);
}
