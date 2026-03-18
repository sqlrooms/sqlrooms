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
  /** Optional extra validation beyond the SQL-identifier check. Returns an
   *  error message string when invalid, or null when the name is acceptable. */
  getValidationError?: (name: string) => string | null;
};

export const SqlCellResultNameEditor: React.FC<
  SqlCellResultNameEditorProps
> = ({value, placeholder, onChange, getValidationError}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateResultName = useCallback(
    (value: string): string | null => {
      const nextValue = value.trim();
      if (!nextValue || !isValidSqlIdentifier(nextValue)) {
        return 'Invalid result name';
      }
      return getValidationError?.(nextValue) ?? null;
    },
    [getValidationError],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setErrorMessage(validateResultName(value));
    },
    [validateResultName],
  );

  const handleChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      const error = validateResultName(nextValue);
      if (error) {
        setErrorMessage(error);
        return;
      }

      onChange(nextValue);
      setErrorMessage(null);
    },
    [onChange, validateResultName],
  );

  return (
    <Tooltip open={errorMessage !== null}>
      <TooltipTrigger asChild>
        <div>
          <EditableText
            className={`h-6 w-40 font-mono text-xs text-green-500 shadow-none ${
              errorMessage !== null
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
        <span className="text-xs">
          {errorMessage ?? 'Invalid result name'}
        </span>
      </TooltipContent>
    </Tooltip>
  );
};
