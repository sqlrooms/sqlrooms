import React, {useCallback} from 'react';
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
import {useCellsStore, type CellsStoreState} from '../hooks';
import type {CellContainerProps, InputCell, InputUnion, Cell} from '../types';
import {InputConfigPanel} from './Input/ConfigPanel/InputConfigPanel';
import {produce} from 'immer';

export type InputCellContentProps = {
  id: string;
  cell: InputCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

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
            value={[input.value as number]}
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
          value={input.value as string}
          onValueChange={(value) => updateInput({value})}
        >
          <SelectTrigger className="h-8 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {(input.options as string[]).map((option: string) => (
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

export const InputCellContent: React.FC<InputCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((s: CellsStoreState) => s.cells.updateCell);
  const removeCell = useCellsStore((s: CellsStoreState) => s.cells.removeCell);
  const input = cell.data.input;

  const updateInput = useCallback(
    (patch: Partial<InputUnion>) => {
      const isValueChange = 'value' in patch;
      updateCell(
        id,
        (c: Cell) =>
          produce(c, (draft) => {
            if (draft.type === 'input') {
              draft.data.input = {...draft.data.input, ...patch} as any;
            }
          }),
        isValueChange ? {cascade: true} : undefined,
      );
    },
    [id, updateCell],
  );

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <EditableText
          value={input.varName}
          onChange={(varName) => updateInput({varName})}
          className="h-6 text-xs font-semibold shadow-none outline-none ring-0"
        />
        <span className="text-[10px] font-bold uppercase text-gray-400">
          Input
        </span>
      </div>
      <InputConfigPanel
        input={input}
        updateInput={updateInput}
        onRemove={() => removeCell(id)}
      />
    </div>
  );

  const content = (
    <div className="p-2">
      <RenderInput input={input} updateInput={updateInput} />
    </div>
  );

  return renderContainer({
    header,
    content,
  });
};
