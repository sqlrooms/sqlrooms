import {
  cn,
  EditableText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {useCallback, useState} from 'react';
import {useValidateResultName} from '../useValidateResultName';

export type SqlCellResultNameEditorProps = {
  cellId: string;
  value: string;
  onChange: (value: string) => void;
};

export const SqlCellResultNameEditor: React.FC<
  SqlCellResultNameEditorProps
> = ({cellId, value, onChange}) => {
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const currentValue = isEditing ? currentInput.trim() : value;

  // Get validation function from hook
  const errorMessage = useValidateResultName(cellId, currentValue);

  const handleInputChange = useCallback((newValue: string) => {
    setCurrentInput(newValue);
  }, []);

  // Called on Enter or Blur - only commit if valid
  const handleChange = useCallback(
    (newValue: string) => {
      if (!errorMessage && newValue !== value) {
        // Valid and changed - commit to store
        onChange(newValue);
      }
      // If invalid or unchanged - don't commit, EditableText will reset to value prop
    },
    [errorMessage, value, onChange],
  );

  // Called when editing starts/ends (including Escape)
  const handleEditingChange = useCallback(
    (editing: boolean) => {
      setIsEditing(editing);
      if (editing) {
        // Track what user is typing for validation
        setCurrentInput(value);
      } else {
        // Clear tracked input
        setCurrentInput('');
      }
    },
    [value],
  );

  return (
    <Tooltip open={Boolean(errorMessage)}>
      <TooltipTrigger asChild>
        <div>
          <EditableText
            className={cn(
              'h-6 w-40 font-mono text-xs text-green-500 shadow-none',
              {
                'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500':
                  Boolean(errorMessage),
              },
            )}
            value={value}
            onInputChange={handleInputChange}
            onChange={handleChange}
            onEditingChange={handleEditingChange}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        {errorMessage && <span className="text-xs">{errorMessage}</span>}
      </TooltipContent>
    </Tooltip>
  );
};
