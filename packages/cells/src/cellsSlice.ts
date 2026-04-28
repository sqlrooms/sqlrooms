import {createId} from '@paralleldrive/cuid2';
import {makePagedQuery} from '@sqlrooms/data-table';
import {sanitizeQuery} from '@sqlrooms/duckdb';
import {createSlice} from '@sqlrooms/room-store';
import {
  convertToValidColumnOrTableName,
  generateUniqueName,
} from '@sqlrooms/utils';
import {produce} from 'immer';
import {
  buildDependencyGraph,
  buildDependencyGraphAsync,
  buildGraphCacheFromEdges,
  collectReachable,
  removeCellFromCache,
  replaceCellDependenciesInCache,
  topologicalOrder,
} from './dagUtils';
import {
  findArtifactIdForCell,
  getRequiredSqlSelectToJson,
  normalizeCellsConfigStructure,
  resolveDependencies,
} from './helpers';
import {dropResultRelation} from './resultRelationPolicy';
import type {
  Cell,
  CellResultData,
  CellsRootState,
  CellsSliceConfig,
  CellsSliceOptions,
  CellsSliceState,
  CrossFilterSelection,
  Edge,
  SqlCell,
  SqlCellData,
} from './types';
import {isInputCell, isSqlCell} from './types';
import {
  getArtifactSchemaName,
  getEffectiveResultName,
  isDefined,
} from './utils';
import {buildCrossFilterPredicate} from './vegaSelectionUtils';

function createDefaultCellsConfig(
  config: Partial<CellsSliceConfig> | undefined,
): CellsSliceConfig {
  const defaultConfig: CellsSliceConfig = {
    data: {},
    artifacts: {},
    tableDepSchemas: ['main'],
  };

  if (!config) {
    return defaultConfig;
  }

  const {artifacts} = normalizeCellsConfigStructure(config);

  return {
    ...defaultConfig,
    ...config,
    artifacts,
  };
}

// --- Slice Implementation ---

export function createCellsSlice(props: CellsSliceOptions) {
  const {cellRegistry} = props;
  const initialConfig = createDefaultCellsConfig(props?.config);
  // Keep result data outside Immer drafts, but scoped per slice instance.
  const cellResultCache = new Map<string, CellResultData>();
  return createSlice<CellsSliceState, CellsRootState>((set, get, store) => {
    const dropRelationBestEffort = async (relationName: string) => {
      try {
        const connector = await get().db.getConnector();
        await dropResultRelation({connector, relationName});
      } catch {
        // Best-effort cleanup
      }
    };

    const dropRelationsForStatus = async (
      cellType: string,
      status: {type: string; [key: string]: unknown} | undefined,
    ) => {
      if (!status) return;
      const registryItem = cellRegistry[cellType];
      const names = registryItem?.getRelationsToDrop?.(status) ?? [];
      for (const name of names) {
        await dropRelationBestEffort(name);
      }
    };

    // Mark cells stale when their dependent database tables change (schema-level).
    store.subscribe((state, prevState) => {
      if (state.db.tables === prevState.db.tables) return;
      const toName = (t: {table: {schema?: string; table: string}}) =>
        `${t.table.schema ?? 'main'}.${t.table.table}`;
      const oldNames = new Set(prevState.db.tables.map(toName));
      const newNames = new Set(state.db.tables.map(toName));
      const changed = new Set<string>();
      for (const n of oldNames) {
        if (!newNames.has(n)) changed.add(n);
      }
      for (const n of newNames) {
        if (!oldNames.has(n)) changed.add(n);
      }
      if (!changed.size) return;

      for (const artifact of Object.values(state.cells.config.artifacts)) {
        const cache = artifact.graphCache;
        if (!cache?.tableDependencies) continue;
        for (const [cellId, tables] of Object.entries(
          cache.tableDependencies,
        )) {
          if (tables.some((t) => changed.has(t))) {
            state.cells.invalidateCellStatus(cellId);
          }
        }
      }
    });

    return {
      cells: {
        cellRegistry,
        config: initialConfig,
        status: {},
        activeAbortControllers: {},
        resultVersion: {},
        pageVersion: {},
        async initialize() {
          for (const [cellId, cell] of Object.entries(
            get().cells.config.data,
          )) {
            const registryItem = cellRegistry[cell.type];
            if (registryItem?.onInitialize) {
              registryItem.onInitialize({
                id: cellId,
                status: get().cells.status[cellId],
                get,
                set,
              });
            }
          }
        },
        setConfig(config: CellsSliceConfig) {
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config = config;
            }),
          );
        },
        crossFilterSelections: {},

        setCrossFilterSelection: (
          chartCellId: string,
          sqlId: string,
          selection: CrossFilterSelection | null,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.cells.crossFilterSelections[sqlId]) {
                draft.cells.crossFilterSelections[sqlId] = {};
              }
              draft.cells.crossFilterSelections[sqlId][chartCellId] = selection;
            }),
          );
        },

        getCrossFilterPredicate: (
          chartCellId: string,
          sqlId: string,
        ): string | null => {
          const group = get().cells.crossFilterSelections[sqlId];
          if (!group) return null;
          const siblingSelections = Object.entries(group)
            .filter(([id]) => id !== chartCellId)
            .map(([, sel]) => sel);
          return buildCrossFilterPredicate(siblingSelections);
        },

        clearCrossFilterGroup: (sqlId: string) => {
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.crossFilterSelections[sqlId];
            }),
          );
        },

        ensureArtifact: (artifactId, options) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.cells.config.artifacts[artifactId]) {
                draft.cells.config.artifacts[artifactId] = {
                  id: artifactId,
                  schemaName:
                    options?.schemaName ?? getArtifactSchemaName(artifactId),
                  cellIds: [],
                  edges: [],
                  graphCache: {
                    dependencies: {},
                    dependents: {},
                    contentHashByCell: {},
                    tableDependencies: {},
                  },
                };
              } else if (
                options?.schemaName &&
                !draft.cells.config.artifacts[artifactId]?.schemaName
              ) {
                draft.cells.config.artifacts[artifactId].schemaName =
                  options.schemaName;
              }
            }),
          );
        },

        addCell: async (artifactId: string, cell: Cell, index?: number) => {
          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = getRequiredSqlSelectToJson(get());
          const targetArtifact = get().cells.config.artifacts[artifactId];
          const scopedCells = Object.fromEntries(
            (targetArtifact?.cellIds ?? [])
              .map((id) => get().cells.config.data[id])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;
          scopedCells[cell.id] = cell;

          // Generate a unique result name for SQL cells if not set
          if (cell.type === 'sql' && !cell.data.resultName) {
            const existingNames = Object.values(scopedCells)
              .filter((c): c is SqlCell => c.type === 'sql' && c.id !== cell.id)
              .map((c) =>
                getEffectiveResultName(c.data, convertToValidColumnOrTableName),
              );
            const baseName = getEffectiveResultName(
              cell.data as SqlCellData,
              convertToValidColumnOrTableName,
            );
            const uniqueName = generateUniqueName(baseName, existingNames);
            (cell as SqlCell).data.resultName = uniqueName;
          }

          const deps = await resolveDependencies(
            cell,
            scopedCells,
            artifactId,
            cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[cell.id] = cell;
              const registryItem = cellRegistry[cell.type];
              draft.cells.status[cell.id] = registryItem?.createStatus?.(
                cell.id,
              ) ?? {type: 'other'};

              // Single-owner invariant: a cell can belong to one artifact only.
              for (const [
                existingArtifactId,
                existingArtifact,
              ] of Object.entries(draft.cells.config.artifacts)) {
                if (existingArtifactId === artifactId) continue;
                existingArtifact.cellIds = existingArtifact.cellIds.filter(
                  (cid) => cid !== cell.id,
                );
                existingArtifact.edges = existingArtifact.edges.filter(
                  (e) => e.source !== cell.id && e.target !== cell.id,
                );
                removeCellFromCache(existingArtifact, cell.id);
              }

              let artifact = draft.cells.config.artifacts[artifactId];
              if (!artifact) {
                artifact = {
                  id: artifactId,
                  schemaName: getArtifactSchemaName(artifactId),
                  cellIds: [],
                  edges: [],
                  graphCache: {
                    dependencies: {},
                    dependents: {},
                    contentHashByCell: {},
                    tableDependencies: {},
                  },
                };
                draft.cells.config.artifacts[artifactId] = artifact;
              }

              const newIndex =
                index !== undefined ? index : artifact.cellIds.length;
              artifact.cellIds = artifact.cellIds.filter(
                (cid) => cid !== cell.id,
              );
              artifact.cellIds.splice(newIndex, 0, cell.id);

              // Add edges from pre-computed dependencies
              artifact.edges = artifact.edges.filter(
                (edge) =>
                  edge.target !== cell.id &&
                  edge.id !== `${edge.source}-${cell.id}`,
              );
              const localCellIds = new Set(artifact.cellIds);
              for (const depId of deps.cellIds) {
                if (!localCellIds.has(depId) || depId === cell.id) continue;
                artifact.edges.push({
                  id: `${depId}-${cell.id}`,
                  source: depId,
                  target: cell.id,
                });
              }
              replaceCellDependenciesInCache(
                artifact,
                cell.id,
                deps.cellIds.filter((depId) => localCellIds.has(depId)),
                deps.tableNames,
              );
            }),
          );
        },

        removeCell: (id: string) => {
          const cell = get().cells.config.data[id];
          const previousStatus = get().cells.status[id];
          cellResultCache.delete(id);
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.config.data[id];
              delete draft.cells.status[id];
              delete draft.cells.resultVersion[id];
              delete draft.cells.pageVersion[id];
              const controller = draft.cells.activeAbortControllers[id];
              if (controller) {
                controller.abort();
                delete draft.cells.activeAbortControllers[id];
              }

              // Remove from all artifacts
              for (const artifact of Object.values(
                draft.cells.config.artifacts,
              )) {
                artifact.cellIds = artifact.cellIds.filter((cid) => cid !== id);
                artifact.edges = artifact.edges.filter(
                  (e) => e.source !== id && e.target !== id,
                );
                removeCellFromCache(artifact, id);
              }
            }),
          );
          if (cell) {
            const registryItem = cellRegistry[cell.type];
            if (registryItem?.onRemove) {
              void registryItem.onRemove({
                id,
                status: previousStatus,
                get,
                set,
              });
            } else {
              void dropRelationsForStatus(cell.type, previousStatus);
            }
          }
        },

        updateCell: async (
          id: string,
          updater: (cell: Cell) => Cell,
          opts?: {cascade?: boolean},
        ) => {
          const cell = get().cells.config.data[id];
          if (!cell) return;
          const ownerArtifactId = findArtifactIdForCell(get(), id);
          const scopedCells = Object.fromEntries(
            (
              (ownerArtifactId &&
                get().cells.config.artifacts[ownerArtifactId]?.cellIds) ||
              []
            )
              .map((cellId) => get().cells.config.data[cellId])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;

          const updatedCell = updater(cell);
          scopedCells[id] = updatedCell;

          const registryItem = cellRegistry[cell.type];

          const existingStatus = get().cells.status[id];
          const oldResultRelation =
            existingStatus && registryItem?.getResultRelation
              ? registryItem.getResultRelation(existingStatus)
              : undefined;

          const semanticInputChanged =
            isInputCell(cell) &&
            isInputCell(updatedCell) &&
            (cell.data.input.varName !== updatedCell.data.input.varName ||
              cell.data.input.value !== updatedCell.data.input.value);
          const semanticSqlChanged =
            isSqlCell(cell) &&
            isSqlCell(updatedCell) &&
            cell.data.sql !== updatedCell.data.sql;

          const semanticChanged =
            registryItem?.hasSemanticChange?.(cell, updatedCell) ?? false;

          // Apply cell data to the store immediately so that other
          // actions (e.g. runCell triggered via Cmd+Enter) always see
          // the latest value. Edge/dependency updates follow
          // asynchronously below.
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[id] = updatedCell;
              if (semanticChanged) {
                const status = draft.cells.status[id];
                if (status && registryItem?.invalidateStatus) {
                  draft.cells.status[id] =
                    registryItem.invalidateStatus(status);
                }
              }
            }),
          );

          // Avoid expensive dependency graph recomputation on each SQL keystroke.
          // We recompute immediately for non-SQL edits, or when callers explicitly
          // request cascading behavior.
          const shouldRecomputeDependencies =
            !semanticSqlChanged || opts?.cascade === true;
          if (shouldRecomputeDependencies) {
            // Pre-compute dependencies outside produce() to support async
            const sqlSelectToJson = getRequiredSqlSelectToJson(get());
            const newDeps = await resolveDependencies(
              updatedCell,
              scopedCells,
              ownerArtifactId || '',
              cellRegistry,
              sqlSelectToJson,
            );

            set((state) =>
              produce(state, (draft) => {
                const ownerSheet = Object.values(
                  draft.cells.config.artifacts,
                ).find((artifact) => artifact.cellIds.includes(id));
                if (ownerSheet) {
                  const localCellIds = new Set(ownerSheet.cellIds);
                  ownerSheet.edges = ownerSheet.edges.filter(
                    (e) => e.target !== id,
                  );
                  for (const depId of newDeps.cellIds) {
                    if (!localCellIds.has(depId) || depId === id) continue;
                    ownerSheet.edges.push({
                      id: `${depId}-${id}`,
                      source: depId,
                      target: id,
                    });
                  }
                  replaceCellDependenciesInCache(
                    ownerSheet,
                    id,
                    newDeps.cellIds.filter((depId) => localCellIds.has(depId)),
                    newDeps.tableNames,
                  );
                }
              }),
            );
          }

          // If the result relation changed name (e.g. SQL resultName changed), rename it
          const newStatus = get().cells.status[id];
          const newResultRelation =
            newStatus && registryItem?.getResultRelation
              ? registryItem.getResultRelation(newStatus)
              : undefined;
          const resultRelationChanged =
            oldResultRelation && newResultRelation !== oldResultRelation;
          if (resultRelationChanged && registryItem?.renameResult) {
            void registryItem.renameResult({
              id,
              oldResultView: oldResultRelation,
              get,
              set,
            });
          }

          // After update, trigger cascade only if explicitly requested
          // or if semantic execution inputs changed.
          const shouldCascade =
            opts?.cascade || resultRelationChanged || semanticInputChanged;
          if (shouldCascade) {
            if (ownerArtifactId) {
              void get().cells.runDownstreamCascade(ownerArtifactId, id);
            }
          }
        },

        removeArtifact: (artifactId: string) => {
          const artifact = get().cells.config.artifacts[artifactId];
          if (!artifact) return;
          const ownedCellIds = [...artifact.cellIds];
          const relationNamesToDrop = ownedCellIds.flatMap((cellId) => {
            const cell = get().cells.config.data[cellId];
            const status = get().cells.status[cellId];
            if (!cell || !status) return [];
            const registryItem = cellRegistry[cell.type];
            return registryItem?.getRelationsToDrop?.(status) ?? [];
          });
          set((state) =>
            produce(state, (draft) => {
              for (const cellId of ownedCellIds) {
                cellResultCache.delete(cellId);
                delete draft.cells.config.data[cellId];
                delete draft.cells.status[cellId];
                delete draft.cells.resultVersion[cellId];
                delete draft.cells.pageVersion[cellId];
                const controller = draft.cells.activeAbortControllers[cellId];
                if (controller) {
                  controller.abort();
                }
                delete draft.cells.activeAbortControllers[cellId];
              }

              for (const existingSheet of Object.values(
                draft.cells.config.artifacts,
              )) {
                existingSheet.cellIds = existingSheet.cellIds.filter(
                  (cid) => !ownedCellIds.includes(cid),
                );
                existingSheet.edges = existingSheet.edges.filter(
                  (e) =>
                    !ownedCellIds.includes(e.source) &&
                    !ownedCellIds.includes(e.target),
                );
                for (const cellId of ownedCellIds) {
                  removeCellFromCache(existingSheet, cellId);
                }
              }

              delete draft.cells.config.artifacts[artifactId];
            }),
          );
          for (const relationName of relationNamesToDrop) {
            void dropRelationBestEffort(relationName);
          }
        },

        addEdge: (artifactId: string, edge: Omit<Edge, 'id'>) => {
          set((state) =>
            produce(state, (draft) => {
              let artifact = draft.cells.config.artifacts[artifactId];
              if (!artifact) {
                artifact = {
                  id: artifactId,
                  schemaName: getArtifactSchemaName(artifactId),
                  cellIds: [],
                  edges: [],
                  graphCache: {
                    dependencies: {},
                    dependents: {},
                    contentHashByCell: {},
                    tableDependencies: {},
                  },
                };
                draft.cells.config.artifacts[artifactId] = artifact;
              }
              if (
                !artifact.cellIds.includes(edge.source) ||
                !artifact.cellIds.includes(edge.target)
              ) {
                return;
              }
              const id = `${edge.source}-${edge.target}`;
              if (!artifact.edges.find((e) => e.id === id)) {
                artifact.edges.push({...edge, id});
                const deps =
                  artifact.graphCache?.dependencies[edge.target] || [];
                replaceCellDependenciesInCache(artifact, edge.target, [
                  ...deps,
                  edge.source,
                ]);
              }
            }),
          );
        },

        removeEdge: (artifactId: string, edgeId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const artifact = draft.cells.config.artifacts[artifactId];
              if (artifact) {
                artifact.edges = artifact.edges.filter((e) => e.id !== edgeId);
                delete artifact.graphCache;
              }
            }),
          );
        },

        updateEdgesFromSql: async (artifactId: string, cellId: string) => {
          const cell = get().cells.config.data[cellId];
          const artifact = get().cells.config.artifacts[artifactId];
          if (!cell || !artifact) return;

          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = getRequiredSqlSelectToJson(get());
          const scopedCells = Object.fromEntries(
            artifact.cellIds
              .map((id) => get().cells.config.data[id])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;
          const deps = await resolveDependencies(
            cell,
            scopedCells,
            artifactId,
            cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              const draftSheet = draft.cells.config.artifacts[artifactId];
              if (draftSheet) {
                draftSheet.edges = draftSheet.edges.filter(
                  (e) => e.target !== cellId,
                );
                const localCellIds = new Set(draftSheet.cellIds);
                for (const depId of deps.cellIds) {
                  if (!localCellIds.has(depId) || depId === cellId) continue;
                  draftSheet.edges.push({
                    id: `${depId}-${cellId}`,
                    source: depId,
                    target: cellId,
                  });
                }
                replaceCellDependenciesInCache(
                  draftSheet,
                  cellId,
                  deps.cellIds.filter((depId) => localCellIds.has(depId)),
                  deps.tableNames,
                );
              }
            }),
          );
        },

        runCell: async (
          id: string,
          opts?: {cascade?: boolean; schemaName?: string},
        ) => {
          const state = get();
          const cell = state.cells.config.data[id];
          if (!cell) return;

          const registryItem = cellRegistry[cell.type];
          if (!registryItem) return;

          if (registryItem.runCell) {
            // Pass get/set to registry's runCell
            await registryItem.runCell({id, opts, get, set});
            return;
          }

          // No default behavior - each cell type must define runCell if needed
        },
        cancelCell: (id: string) => {
          const state = get();
          const controller = state.cells.activeAbortControllers[id];
          if (controller) {
            controller.abort();
          }
        },
        invalidateCellStatus: (id: string) => {
          const cell = get().cells.config.data[id];
          if (!cell) return;
          const registryItem = cellRegistry[cell.type];
          set((state) =>
            produce(state, (draft) => {
              const status = draft.cells.status[id];
              if (status && registryItem?.invalidateStatus) {
                draft.cells.status[id] = registryItem.invalidateStatus(status);
              }
            }),
          );
        },

        // Cell result cache actions
        setCellResult: (id: string, data: CellResultData) => {
          cellResultCache.set(id, data);
          set((state) =>
            produce(state, (draft) => {
              draft.cells.resultVersion[id] =
                (draft.cells.resultVersion[id] ?? 0) + 1;
            }),
          );
        },

        setCellResultPage: (id: string, data: CellResultData) => {
          cellResultCache.set(id, data);
          set((state) =>
            produce(state, (draft) => {
              draft.cells.pageVersion[id] =
                (draft.cells.pageVersion[id] ?? 0) + 1;
            }),
          );
        },

        getCellResult: (id: string) => {
          return cellResultCache.get(id);
        },

        clearCellResult: (id: string) => {
          cellResultCache.delete(id);
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.resultVersion[id];
              delete draft.cells.pageVersion[id];
            }),
          );
        },

        fetchCellResultPage: async (
          id: string,
          pagination: {pageIndex: number; pageSize: number},
          sorting?: {id: string; desc: boolean}[],
        ) => {
          const state = get();
          const cell = state.cells.config.data[id];
          if (!cell) return;
          const registryItem = cellRegistry[cell.type];
          const status = state.cells.status[id];
          const resultRelation =
            status && registryItem?.getResultRelation
              ? registryItem.getResultRelation(status)
              : undefined;
          if (!resultRelation) return;

          const connector = await state.db.getConnector();
          const baseQuery = sanitizeQuery(`SELECT * FROM ${resultRelation}`);
          const pagedQuery = makePagedQuery(
            baseQuery,
            sorting ?? [],
            pagination,
          );

          const arrowTable = await connector.query(pagedQuery);
          const countResult = await connector.query(
            `SELECT COUNT(*)::int AS count FROM ${resultRelation}`,
          );
          const totalRows = countResult.toArray()[0]?.count ?? 0;

          get().cells.setCellResultPage(id, {arrowTable, totalRows});
        },

        // DAG methods (sync versions for UI usage)
        getArtifactIdForCell: (cellId: string) => {
          return findArtifactIdForCell(get(), cellId);
        },
        getRootCells: (artifactId: string) => {
          const {dependencies} = buildDependencyGraph(artifactId, get());
          const ids = Object.keys(dependencies);
          return ids.filter((id) => (dependencies[id]?.length ?? 0) === 0);
        },
        getDownstream: (artifactId: string, sourceCellId: string) => {
          const {dependencies, dependents} = buildDependencyGraph(
            artifactId,
            get(),
          );
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
        // Async cascade execution using AST-based dependency resolution
        runAllCellsCascade: async (artifactId: string) => {
          const cached = buildDependencyGraph(artifactId, get());
          const hasCachedNodes = Object.keys(cached.dependencies).length > 0;
          if (!hasCachedNodes) {
            set((state) =>
              produce(state, (draft) => {
                const artifact = draft.cells.config.artifacts[artifactId];
                if (artifact) {
                  artifact.graphCache = buildGraphCacheFromEdges(artifact);
                }
              }),
            );
          }
          const sqlSelectToJson = getRequiredSqlSelectToJson(get());
          const {dependencies, dependents} = await buildDependencyGraphAsync(
            artifactId,
            get(),
            sqlSelectToJson,
          );
          const roots = Object.keys(dependencies).filter(
            (id) => (dependencies[id]?.length ?? 0) === 0,
          );
          const order = topologicalOrder(roots, dependencies, dependents);
          for (const cellId of order) {
            try {
              await get().cells.runCell(cellId, {cascade: false});
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              const failedCell = get().cells.config.data[cellId];
              const failedRegistryItem = failedCell
                ? cellRegistry[failedCell.type]
                : undefined;
              if (failedRegistryItem?.recordError) {
                set((state) =>
                  produce(state, (draft) => {
                    const status = draft.cells.status[cellId];
                    if (status) {
                      draft.cells.status[cellId] =
                        failedRegistryItem.recordError!(status, message);
                    }
                  }),
                );
              }
            }
          }
        },
        runDownstreamCascade: async (
          artifactId: string,
          sourceCellId: string,
        ) => {
          const cached = buildDependencyGraph(artifactId, get());
          const hasCachedNodes = Object.keys(cached.dependencies).length > 0;
          if (!hasCachedNodes) {
            set((state) =>
              produce(state, (draft) => {
                const artifact = draft.cells.config.artifacts[artifactId];
                if (artifact) {
                  artifact.graphCache = buildGraphCacheFromEdges(artifact);
                }
              }),
            );
          }
          const sqlSelectToJson = getRequiredSqlSelectToJson(get());
          const {dependencies, dependents} = await buildDependencyGraphAsync(
            artifactId,
            get(),
            sqlSelectToJson,
          );
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
            try {
              await get().cells.runCell(cellId, {cascade: false});
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              const failedCell = get().cells.config.data[cellId];
              const failedRegistryItem = failedCell
                ? cellRegistry[failedCell.type]
                : undefined;
              if (failedRegistryItem?.recordError) {
                set((state) =>
                  produce(state, (draft) => {
                    const status = draft.cells.status[cellId];
                    if (status) {
                      draft.cells.status[cellId] =
                        failedRegistryItem.recordError!(status, message);
                    }
                  }),
                );
              }
            }
          }
        },
      },
    } as CellsSliceState;
  });
}
