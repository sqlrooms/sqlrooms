import {StoreMutatorIdentifier, StateCreator} from 'zustand';
import {NamedSet} from 'zustand/middleware';

type Write<T, U> = Omit<T, keyof U> & U;

type Action = {type: string};

type StoreRedux<A> = {
  dispatch: (a: A) => A;
  dispatchFromDevtools: true;
};

type ReduxState<A> = {
  dispatch: StoreRedux<A>['dispatch'];
};

type WithRedux<S, A> = Write<S, StoreRedux<A>>;

type Redux = <
  T,
  A extends Action,
  Cms extends [StoreMutatorIdentifier, unknown][] = [],
>(
  reducer: (state: T, action: A) => T,
  initialState: T,
) => StateCreator<Write<T, ReduxState<A>>, Cms, [['zustand/redux', A]]>;

declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    'zustand/redux': WithRedux<S, A>;
  }
}

type ReduxImpl = <T, A extends Action>(
  reducer: (state: T, action: A) => T,
  initialState: T,
) => StateCreator<T & ReduxState<A>, [], []>;

import {taskMiddleware} from 'react-palm/tasks';

const reduxImpl: ReduxImpl = (reducer, initial) => (set, _get, api) => {
  type S = typeof initial;
  type A = Parameters<typeof reducer>[1];

  const plainDispatch = (action: A) => {
    (set as NamedSet<S>)(
      (state: S) => ({
        ...state,
        kepler: {
          ...state.kepler,
          ...reducer({map: state.kepler.map}, action),
        },
      }),
      false,
      action,
    );
    return action;
  };

  const processTasks = taskMiddleware({dispatch: plainDispatch});
  (api as any).dispatch = (action: A) => {
    processTasks(plainDispatch)(action);
    plainDispatch(action);
    return action;
  };

  (api as any).dispatchFromDevtools = true;

  return {dispatch: (...args) => (api as any).dispatch(...args), ...initial};
};
export const redux = reduxImpl as unknown as Redux;
