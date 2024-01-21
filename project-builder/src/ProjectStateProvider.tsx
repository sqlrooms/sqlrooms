import React, {createContext, FC, useContext, useRef} from 'react';
import {useStore} from 'zustand';
import {
  createProjectStore,
  CreateProjectStoreProps,
  ProjectState,
  ProjectStore,
} from './ProjectStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const ProjectStateContext = createContext<ProjectStore | null>(null);

type Props = React.PropsWithChildren<
  CreateProjectStoreProps & {projectStore?: ProjectStore}
>;

export const ProjectStateProvider: FC<Props> = ({
  children,
  projectStore,
  ...props
}) => {
  const storeRef = useRef<ProjectStore>();
  if (!storeRef.current) {
    storeRef.current = projectStore ?? createProjectStore(props);
  }
  return (
    <ProjectStateContext.Provider value={storeRef.current}>
      {children}
    </ProjectStateContext.Provider>
  );
};

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  const store = useContext(ProjectStateContext);
  if (!store) {
    throw new Error('Missing ProjectStateProvider in the tree');
  }
  return useStore(store, selector);
}
