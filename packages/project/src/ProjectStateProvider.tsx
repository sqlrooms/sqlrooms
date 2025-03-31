import React, {createContext, ReactNode, useContext} from 'react';
import {StoreApi, useStore} from 'zustand';
import {ProjectState, ProjectStore} from './ProjectStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const ProjectStateContext = createContext<ProjectStore<unknown> | null>(
  null,
);

export type ProjectStateProviderProps<PC> = React.PropsWithChildren<{
  projectStore?: ProjectStore<PC>;
}>;

export function ProjectStateProvider<PC>({
  children,
  projectStore,
}: ProjectStateProviderProps<PC>): ReactNode {
  return (
    <ProjectStateContext.Provider
      value={projectStore as unknown as ProjectStore<unknown>}
    >
      {children}
    </ProjectStateContext.Provider>
  );
}

export function useBaseProjectStore<PC, PS extends ProjectState<PC>, T>(
  selector: (state: ProjectState<PC>) => T,
): T {
  const store = useContext(ProjectStateContext);
  if (!store) {
    throw new Error('Missing ProjectStateProvider in the tree');
  }
  return useStore(store as unknown as StoreApi<PS>, selector);
}
