import React from 'react';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';

export const InputCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'input') return null;
  const input = cell.input;
  return (
    <CellContainer id={id} typeLabel="Input">
      <div className="p-2 text-sm">
        <div className="mb-2">
          <label className="mr-2">Variable:</label>
          <input
            className="rounded border px-2 py-1"
            value={input.varName}
            onChange={(e) =>
              update(
                id,
                (c) =>
                  ({
                    ...c,
                    input: {...(c as any).input, varName: e.target.value},
                  }) as typeof cell,
              )
            }
          />
        </div>
        {input.kind === 'text' && (
          <input
            className="w-full rounded border px-2 py-1"
            value={input.value}
            onChange={(e) =>
              update(
                id,
                (c) =>
                  ({
                    ...c,
                    input: {...(c as any).input, value: e.target.value},
                  }) as typeof cell,
              )
            }
          />
        )}
        {input.kind === 'slider' && (
          <input
            type="range"
            min={input.min}
            max={input.max}
            step={input.step}
            value={input.value}
            onChange={(e) =>
              update(
                id,
                (c) =>
                  ({
                    ...c,
                    input: {
                      ...(c as any).input,
                      value: Number(e.target.value),
                    },
                  }) as typeof cell,
              )
            }
          />
        )}
        {input.kind === 'dropdown' && (
          <select
            className="rounded border px-2 py-1"
            value={input.value}
            onChange={(e) =>
              update(
                id,
                (c) =>
                  ({
                    ...c,
                    input: {...(c as any).input, value: e.target.value},
                  }) as typeof cell,
              )
            }
          >
            {input.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>
    </CellContainer>
  );
};
