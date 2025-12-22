import type {CellsRootState, DagSliceState} from './types';
import {
  buildDependencyGraph,
  collectReachable,
  topologicalOrder,
} from './dagUtils';

export function createDagSlice<TRootState extends CellsRootState>(): (
  set: any,
  get: () => TRootState,
) => DagSliceState {
  return (set, get) => ({
    dag: {
      get currentDagId() {
        return get().cells.config.currentSheetId;
      },
      getRootCells: (sheetId: string) => {
        const {dependencies} = buildDependencyGraph(sheetId, get());
        const ids = Object.keys(dependencies);
        return ids.filter((id) => (dependencies[id]?.length ?? 0) === 0);
      },
      getDownstream: (sheetId: string, sourceCellId: string) => {
        const {dependencies, dependents} = buildDependencyGraph(sheetId, get());
        const reachable = collectReachable(sourceCellId, dependents);
        if (!reachable.size) return [];
        reachable.delete(sourceCellId);
        const rootsWithinScope = Array.from(reachable).filter((id) => {
          const deps = dependencies[id] || [];
          return deps.filter((d) => reachable.has(d)).length === 0;
        });
        return topologicalOrder(
          rootsWithinScope,
          dependencies,
          dependents,
          reachable,
        );
      },
      runAllCellsCascade: async (sheetId: string) => {
        const {dependencies, dependents} = buildDependencyGraph(sheetId, get());
        const roots = Object.keys(dependencies).filter(
          (id) => (dependencies[id]?.length ?? 0) === 0,
        );
        const order = topologicalOrder(roots, dependencies, dependents);
        for (const cellId of order) {
          await get().cells.runCell(cellId, {cascade: false});
        }
      },
      runDownstreamCascade: async (sheetId: string, sourceCellId: string) => {
        const {dependencies, dependents} = buildDependencyGraph(sheetId, get());
        const reachable = collectReachable(sourceCellId, dependents);
        if (!reachable.size) return;
        reachable.delete(sourceCellId);
        const rootsWithinScope = Array.from(reachable).filter((id) => {
          const deps = dependencies[id] || [];
          return deps.filter((d) => reachable.has(d)).length === 0;
        });
        const order = topologicalOrder(
          rootsWithinScope,
          dependencies,
          dependents,
          reachable,
        );
        for (const cellId of order) {
          await get().cells.runCell(cellId, {cascade: false});
        }
      },
    },
  });
}
