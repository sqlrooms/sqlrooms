import type {
  PivotConfig,
  PivotField,
  PivotQuerySource,
  PivotSource,
  PivotStatus,
} from './types';

export type PivotPersistedState = {
  source?: PivotSource;
  config: PivotConfig;
};

export type PivotRuntimeState = {
  status: PivotStatus;
  querySource?: PivotQuerySource;
  fields: PivotField[];
  availableTables: string[];
};

export type PivotHostBinding<RootState, Id extends string = string> = {
  getPersistedState: (
    rootState: RootState,
    id: Id,
  ) => PivotPersistedState | undefined;
  setPersistedState: (
    id: Id,
    updater: (current: PivotPersistedState) => PivotPersistedState,
  ) => void;
  getRuntimeState: (rootState: RootState, id: Id) => PivotRuntimeState;
  run: (id: Id) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
};
