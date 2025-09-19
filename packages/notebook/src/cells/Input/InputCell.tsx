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
import {ParameterConfigPanel} from './ParameterConfigPanel/ParameterConfigPanel';
import {ParameterUnion} from '../../cellSchemas';

const RenderInput: React.FC<{
  input: ParameterUnion;
  updateInput: (patch: Partial<ParameterUnion>) => void;
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

export const InputCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'input') return null;
  const input = cell.input;
  const updateInput = (patch: Partial<typeof input>) =>
    update(
      id,
      (c) =>
        ({
          ...c,
          input: {...(c as any).input, ...(patch as any)},
        }) as typeof cell,
    );

  return (
    <CellContainer id={id} typeLabel="Input">
      <div className="flex w-[200px] flex-col gap-1 p-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <EditableText
            value={input.varName}
            onChange={(varName) => updateInput({varName})}
            className="h-6 text-xs font-semibold"
          />
          <ParameterConfigPanel input={input} updateInput={updateInput} />
        </div>
        <RenderInput input={input} updateInput={updateInput} />
      </div>
    </CellContainer>
  );
};
