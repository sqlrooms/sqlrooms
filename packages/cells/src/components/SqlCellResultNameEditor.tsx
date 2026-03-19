import {
  EditableText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {useCallback, useState} from 'react';
import {isValidSqlIdentifier} from '../utils';

export type SqlCellResultNameEditorProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export const SqlCellResultNameEditor: React.FC<
  SqlCellResultNameEditorProps
> = ({value, placeholder, onChange}) => {
  const [isInvalid, setIsInvalid] = useState(false);

  const validateResultName = useCallback((value: string) => {
    const nextValue = value.trim();
    return Boolean(nextValue) && isValidSqlIdentifier(nextValue);
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setIsInvalid(!validateResultName(value));
    },
    [validateResultName],
  );

  const handleChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (!validateResultName(nextValue)) {
        setIsInvalid(true);
        return;
      }

      onChange(nextValue);
      setIsInvalid(false);
    },
    [onChange, validateResultName],
  );

  return (
    <Tooltip open={isInvalid}>
      <TooltipTrigger asChild>
        <div>
          <EditableText
            className={`h-6 w-40 font-mono text-xs text-green-500 shadow-none ${
              isInvalid
                ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
            value={value || placeholder}
            onInputChange={handleInputChange}
            onChange={handleChange}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">Invalid result name</span>
      </TooltipContent>
    </Tooltip>
  );
};
