import {
  createProjectSlice,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {createStore} from 'zustand';
import {INITIAL_PROJECT_STATE} from './initial-project-state';

export type DemoProjectConfig = BaseProjectConfig;

export type DemoProjectStore = ReturnType<typeof createDemoProjectStore>;

export type DemoProjectState = ProjectState<DemoProjectConfig> & {};

export const createDemoProjectStore = () =>
  createStore<DemoProjectState>()((set, get, store) => {
    const baseProjectStore = createProjectSlice<DemoProjectConfig>(
      INITIAL_PROJECT_STATE,
    )(set, get, store);
    const demoProjectState: DemoProjectState = {
      // Base project store provided by @sqlrooms/project-builder
      ...baseProjectStore,
    };
    return demoProjectState;
  });

export default function useProjectStore<T>(
  selector: (state: DemoProjectState) => T,
): T {
  return useBaseProjectStore(
    selector as (state: ProjectState<DemoProjectConfig>) => T,
  );
}
