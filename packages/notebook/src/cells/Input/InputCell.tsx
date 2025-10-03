import React from 'react';
import {
  EditableText,
  Input,
  Slider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

import {CellContainer} from '../CellContainer';
import {useStoreWithNotebook} from '../../NotebookSlice';
import {InputConfigPanel} from './InputConfigPanel/InputConfigPanel';
import {
  InputUnion,
  InputCell as InputCellType,
  NotebookCell,
} from '../../cellSchemas';

const RenderInput: React.FC<{
  input: InputUnion;
  updateInput: (patch: Partial<InputUnion>) => void;
}> = ({input, updateInput}) => {
  switch (input.kind) {
    case 'text':
      return (
        <Input
          className="h-8 w-full rounded border px-2 py-1 text-sm"
          value={input.value}
          onChange={(e) => updateInput({value: e.target.value})}
        />
      );
    case 'slider':
      return (
        <div className="flex h-8 items-center space-x-1">
          <Slider
            min={input.min}
            max={input.max}
            step={input.step}
            value={[input.value]}
            onValueChange={(value) => updateInput({value: Number(value)})}
          />
          <span className="min-w-[3ch] text-right text-sm font-medium">
            {input.value}
          </span>
        </div>
      );
    case 'dropdown':
      return (
        <Select
          value={input.value}
          onValueChange={(value) => updateInput({value})}
        >
          <SelectTrigger className="h-8 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {input.options.map((option) => (
              <SelectItem className="text-xs" key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return null;
  }
};

export const InputItem: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const remove = useStoreWithNotebook((s) => s.notebook.removeCell);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'input') return null;
  const input = cell.input;

  const updateInput = (patch: Partial<InputUnion>) =>
    update(id, (cell) => {
      const typed = cell as InputCellType;
      return {
        ...typed,
        input: {...typed.input, ...patch},
      } as NotebookCell;
    });

  return (
    <div className="mx-2 flex w-[200px] flex-col gap-1 py-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <EditableText
          value={input.varName}
          onChange={(varName) => updateInput({varName})}
          className="h-6 text-xs font-semibold"
        />
        <InputConfigPanel
          input={input}
          updateInput={updateInput}
          onRemove={() => remove(id)}
        />
      </div>
      <RenderInput input={input} updateInput={updateInput} />
    </div>
  );
};

export const InputCell: React.FC<{id: string}> = ({id}) => {
  return (
    <CellContainer id={id} typeLabel="Input">
      <div className="p-2">
        <InputItem id={id} />
      </div>
    </CellContainer>
  );
};
