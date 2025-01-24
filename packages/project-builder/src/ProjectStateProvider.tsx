import {BaseProjectConfig} from '@sqlrooms/project-config';
import React, {createContext, ReactNode, useContext} from 'react';
import {useStore} from 'zustand';
import {ProjectState, ProjectStore} from './ProjectStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const ProjectStateContext =
  createContext<ProjectStore<BaseProjectConfig> | null>(null);

export type ProjectStateProviderProps<PC extends BaseProjectConfig> =
  React.PropsWithChildren<{
    projectStore?: ProjectStore<PC>;
  }>;

export function ProjectStateProvider<PC extends BaseProjectConfig>({
  children,
  projectStore,
}: ProjectStateProviderProps<PC>): ReactNode {
  return (
    <ProjectStateContext.Provider
      value={projectStore as unknown as ProjectStore<BaseProjectConfig>}
    >
      {children}
    </ProjectStateContext.Provider>
  );
}

export function useBaseProjectStore<PC extends BaseProjectConfig, T>(
  selector: (state: ProjectState<PC>) => T,
): T {
  const store = useContext(ProjectStateContext);
  if (!store) {
    throw new Error('Missing ProjectStateProvider in the tree');
  }
  return useStore(store as ProjectStore<PC>, selector);
}
