import {useState} from 'react';
import {Button, Input, Label} from '@sqlrooms/ui';
import {OctagonAlertIcon, XIcon} from 'lucide-react';
import {useFormContext, useFieldArray} from 'react-hook-form';

export const DropdownConfig = () => {
  const {control, watch} = useFormContext();
  const options = watch('options') || [];

  const [option, setOption] = useState('');
  const [warning, setWarning] = useState('');

  const {remove, append} = useFieldArray({control, name: 'options'});

  const handleAddOption = () => {
    const trimmedOption = option.trim();
    if (!trimmedOption) return;

    if (options.includes(trimmedOption)) {
      setWarning('This value already exists');
      return;
    }

    append(trimmedOption);
    setOption('');
    setWarning('');
  };

  const handleRemoveOption = (index: number) => {
    remove(index);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>
          Values <span className="text-gray-500">(strings)</span>
        </Label>
        <div className="flex flex-col gap-2">
          <div className="flex max-h-32 flex-wrap gap-1 overflow-auto text-xs">
            {options.map((value: string, index: number) => (
              <span
                className="bg-secondary flex items-center gap-1 rounded-md px-2 py-1"
                key={index}
              >
                {value}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-4 w-4 p-0"
                  onClick={() => handleRemoveOption(index)}
                >
                  <XIcon size={12} strokeWidth={1.5} />
                </Button>
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            <Input
              className="h-8"
              value={option}
              onChange={(e) => {
                setOption(e.target.value);
                if (warning) setWarning('');
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleAddOption}
            >
              Add
            </Button>
          </div>

          {warning && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <OctagonAlertIcon size={16} strokeWidth={1.5} />
              {warning}
            </div>
          )}
        </div>
      </div>

      {/* <div className="flex flex-col gap-2">
        <Label>Default Value</Label>
        <Select
          value={defaultValue}
          onValueChange={(v) => setValue('value', v)}
        >
          <SelectTrigger className="h-8 shadow-none">
            <SelectValue placeholder="Select a default value" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {options.map((option: string) => (
              <SelectItem className="text-xs" key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div> */}
    </>
  );
};
