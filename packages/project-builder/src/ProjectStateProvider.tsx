import {BaseProjectConfig} from '@sqlrooms/project-config';
import React, {createContext, ReactNode, useContext, useRef} from 'react';
import {useStore} from 'zustand';
import {
  createProjectStore,
  CreateProjectStoreProps,
  ProjectState,
  ProjectStore,
} from './ProjectStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const ProjectStateContext =
  createContext<ProjectStore<BaseProjectConfig> | null>(null);

type Props<PC extends BaseProjectConfig> = React.PropsWithChildren<
  CreateProjectStoreProps<PC> & {projectStore?: ProjectStore<PC>}
>;

export function ProjectStateProvider<PC extends BaseProjectConfig>(
  props: Props<PC>,
): ReactNode {
  const {children, projectStore, ...restProps} = props;
  const storeRef = useRef<ProjectStore<PC>>();
  if (!storeRef.current) {
    storeRef.current = projectStore ?? createProjectStore<PC>(restProps);
  }
  return (
    <ProjectStateContext.Provider
      value={storeRef.current as unknown as ProjectStore<BaseProjectConfig>}
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
  return useStore(store as unknown as ProjectStore<PC>, selector);
}
