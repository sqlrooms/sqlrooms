import {createId} from '@paralleldrive/cuid2';
import {type Cell, type CellsSliceState} from '@sqlrooms/cells';
import {DbSliceState} from '@sqlrooms/db';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {NotebookCell, NotebookSliceConfig} from './cellSchemas';
import type {NotebookSliceState} from './NotebookStateTypes';
import {getCellTypeLabel} from './NotebookUtils';

/**
 * Create default `notebook.config` structure with no cells.
 */
export function createDefaultNotebookConfig(
  props: Partial<NotebookSliceConfig> = {},
): NotebookSliceConfig {
  const base: NotebookSliceConfig = {
    artifacts: {},
    currentCellId: undefined,
  };

  // If already a DAG config, merge over the base
  return {...base, ...props};
}

function getArtifact(config: NotebookSliceConfig, artifactId: string) {
  return config.artifacts[artifactId];
}

function findArtifactIdByCellId(
  config: NotebookSliceConfig,
  cellId: string,
): string | undefined {
  for (const [artifactId, artifact] of Object.entries(config.artifacts)) {
    if (artifact?.meta.cellOrder.includes(cellId)) {
      return artifactId;
    }
  }
  return undefined;
}

/**
 * Create the Notebook slice with tabs, cells, execution and dependency handling.
 * Supports pluggable custom renderers via options.
 */
export function createNotebookSlice(props?: {
  config?: Partial<NotebookSliceConfig>;
}) {
  type NotebookRootState = BaseRoomStoreState &
    DbSliceState &
    NotebookSliceState &
    CellsSliceState;

  return createSlice<NotebookSliceState, NotebookRootState>(
    (set, get, _store) => {
      return {
        notebook: {
          schemaName: 'notebook',

          config: createDefaultNotebookConfig(props?.config ?? {}),

          setSchemaName: (name) =>
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.schemaName = name;
              }),
            ),

          ensureArtifact: (artifactId) => {
            get().cells.ensureArtifact(artifactId);
            set((state) =>
              produce(state, (draft) => {
                if (!draft.notebook.config.artifacts[artifactId]) {
                  draft.notebook.config.artifacts[artifactId] = {
                    id: artifactId,
                    meta: {
                      cellOrder: [],
                    },
                  };
                }
              }),
            );
          },

          removeArtifact: (artifactId) => {
            get().cells.removeArtifact(artifactId);
            set((state) =>
              produce(state, (draft) => {
                delete draft.notebook.config.artifacts[artifactId];
              }),
            );
          },

          addCell: async (artifactId, type, index) => {
            const id = createId();
            const reg = get().cells.cellRegistry[type];
            if (!reg) return id;

            const cell = reg.createCell({id, get, set}) as Cell;

            // Assign a readable unique name using shared utility
            const allCells = Object.values(get().cells.config.data);
            const usedNames = allCells
              .map((c) => {
                const title = (c.data as Record<string, unknown>).title;
                return typeof title === 'string' ? title : undefined;
              })
              .filter((v): v is string => Boolean(v));
            const baseLabel = getCellTypeLabel(cell.type);
            if (baseLabel) {
              const current = cell.data as Record<string, unknown>;
              current.title = generateUniqueName(
                `${baseLabel} 1`,
                usedNames,
                ' ',
              );
            }

            if (type === 'input') {
              const usedInputNames = allCells
                .filter((c) => c.type === 'input')
                .map(
                  (c) =>
                    (c.data as {input?: {varName?: string}}).input?.varName ??
                    '',
                )
                .filter((name) => Boolean(name));
              if (cell.type === 'input') {
                cell.data.input.varName = generateUniqueName(
                  cell.data.input.varName,
                  usedInputNames,
                );
              }
            }

            get().cells.ensureArtifact(artifactId);
            await get().cells.addCell(artifactId, cell, index);

            set((state) =>
              produce(state, (draft) => {
                let artifact = getArtifact(draft.notebook.config, artifactId);
                if (!artifact) {
                  artifact = {
                    id: artifactId,
                    meta: {
                      cellOrder: [],
                    },
                  };
                  draft.notebook.config.artifacts[artifactId] = artifact;
                }

                // cellOrder
                const newIndex = index ?? artifact.meta.cellOrder.length;
                artifact.meta.cellOrder.splice(newIndex, 0, id);

                draft.notebook.config.currentCellId = id;
              }),
            );
            return id;
          },

          moveCell: (artifactId, cellId, direction) => {
            set((state) =>
              produce(state, (draft) => {
                const artifact = getArtifact(draft.notebook.config, artifactId);
                if (!artifact) return;

                const idx = artifact.meta.cellOrder.indexOf(cellId);
                if (idx >= 0) {
                  const newIndex = direction === 'up' ? idx - 1 : idx + 1;
                  if (
                    newIndex < 0 ||
                    newIndex >= artifact.meta.cellOrder.length
                  )
                    return;

                  artifact.meta.cellOrder.splice(idx, 1);
                  artifact.meta.cellOrder.splice(newIndex, 0, cellId);
                }
              }),
            );
          },

          removeCell: (cellId) => {
            get().cells.removeCell(cellId);
            set((state) =>
              produce(state, (draft) => {
                const artifactId = findArtifactIdByCellId(
                  draft.notebook.config,
                  cellId,
                );
                if (!artifactId) return;
                const artifact = getArtifact(draft.notebook.config, artifactId);
                if (!artifact) return;

                artifact.meta.cellOrder = artifact.meta.cellOrder.filter(
                  (id) => id !== cellId,
                );
              }),
            );
          },

          renameCell: (cellId, name) => {
            void get().cells.updateCell(cellId, (cell) => ({
              ...cell,
              data: {...cell.data, title: name},
            }));
          },

          updateCell: (cellId, updater) => {
            void get().cells.updateCell(cellId, (cell) => {
              return updater(cell as NotebookCell) as Cell;
            });
          },

          setCurrentCell: (id) => {
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.currentCellId = id;
              }),
            );
          },

          cancelRunCell: (cellId) => {
            get().cells.cancelCell(cellId);
          },

          runAllCells: async (artifactId) => {
            const artifact = getArtifact(get().notebook.config, artifactId);
            if (!artifact) return;
            for (const cellId of artifact.meta.cellOrder) {
              await get().cells.runCell(cellId, {cascade: false});
            }
          },

          runAllCellsCascade: async (artifactId) => {
            await get().cells.runAllCellsCascade(artifactId);
          },

          runCell: async (cellId, opts) => {
            await get().cells.runCell(cellId, opts);
          },
        },
      };
    },
  );
}
