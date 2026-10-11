import {useCallback, useRef, type FC, type ReactNode} from 'react';

/**
 * Maps a stable id to a stable component type whose output may change.
 */
export type ChatTurnContentBinder = (id: string, render: () => ReactNode) => FC;

type ChatTurnContentBinding = {
  render: () => ReactNode;
  Component: FC;
};

/**
 * Keeps pre-wired turn content components stable across presentation rebuilds.
 *
 * A turn's presentation is rebuilt whenever its model changes, which during
 * streaming happens on every token. Creating a fresh component function per
 * rebuild changes the element type, so React unmounts and remounts the subtree:
 * rich tool output (charts, maps) restarts its queries and activity chrome
 * loses its expand/collapse state. Binding one component type per id turns
 * those rebuilds back into plain re-renders.
 */
export function useChatTurnContentBinder(): ChatTurnContentBinder {
  const bindingsRef = useRef<Map<string, ChatTurnContentBinding>>(new Map());

  return useCallback((id, render) => {
    const bindings = bindingsRef.current;
    const existing = bindings.get(id);
    if (existing) {
      existing.render = render;
      return existing.Component;
    }

    const binding = {render} as ChatTurnContentBinding;
    binding.Component = () => binding.render();
    binding.Component.displayName = `ChatTurnContent(${id})`;
    bindings.set(id, binding);
    return binding.Component;
  }, []);
}
