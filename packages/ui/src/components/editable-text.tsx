'use client';

import {ChangeEvent, FC, useCallback, useEffect, useRef, useState} from 'react';

import {Input} from './input';
import {cn} from '../lib/utils';

/**
 * Component that allows the user to edit a string.
 *
 * The editing mode can be controlled (the mode is managed by the parent component)
 * or uncontrolled (managed by the component itself).
 *
 * Controlled mode example:
 * ```
 *    const [text, setText] = useState('');
 *    const [isEditing, setEditing] = useState(false);
 *    ...
 *    <EditableText
 *       value={text}
 *       onChange={setText}
 *       isEditing={isEditing}
 *       onEditingChange={setEditing}
 *    />
 * ```
 *
 * Uncontrolled mode example:
 * ```
 *    const [text, setText] = useState('');
 *    ...
 *    <EditableText
 *      value={text}
 *      onChange={setText}
 *      defaultEditing={false}
 *    />
 * ```
 */

export const EditableText: FC<{
  className?: string;
  isReadOnly?: boolean;
  editTrigger?: 'click' | 'doubleClick';
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;

  /**
   * The editing state when it is initially rendered. Use when you do not need to control its editing state
   * in the parent component.
   **/
  defaultEditing?: boolean;

  /**
   * The controlled editing state of the component. Must be used in conjunction with onEditingChange.
   **/
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
}> = ({
  className,
  isReadOnly = false,
  defaultEditing = false,
  editTrigger = 'click',
  isEditing,
  placeholder,
  value,
  onChange,
  onEditingChange,
}) => {
  const [isInternalEditing, setInternalIsEditing] = useState(defaultEditing);
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const internalValueRef = useRef(internalValue);

  useEffect(() => {
    internalValueRef.current = internalValue;
  }, [internalValue]);

  // Keep internalValue in sync with value prop
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (value !== internalValueRef.current) {
      setInternalValue(value);
    }
  }, [value]);

  // Keep internal editing state in sync with controlled isEditing prop
  // and focus the input when editing is enabled
  useEffect(() => {
    if (isEditing !== undefined && isEditing !== isInternalEditing) {
      setInternalIsEditing(Boolean(isEditing));
      if (isEditing) {
        // When enabling editing from a dropdown menu, there will be a blur event when the dropdown closes,
        // so we need to wait a bit before making sure the input is focused and selected
        const timeoutId = setTimeout(() => {
          inputRef.current?.select();
          inputRef.current?.focus();
        }, 200);
        return () => clearTimeout(timeoutId);
      }
    }
    return undefined;
  }, [isEditing, isInternalEditing]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSetValue = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly || !isInternalEditing) {
        return;
      }
      return setInternalValue(e.target.value);
    },
    [isInternalEditing, isReadOnly],
  );

  const handleSetEditing = useCallback(
    (nextIsEditing: boolean) => {
      if (isReadOnly) {
        return;
      }
      setInternalIsEditing(nextIsEditing);
      onEditingChange?.(nextIsEditing);
    },
    [isReadOnly, onEditingChange],
  );

  const handleBlur = useCallback(() => {
    handleSetEditing(false);
    onChange(internalValueRef.current?.trim());
  }, [handleSetEditing, onChange]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      if (!isInternalEditing) {
        inputRef.current?.select();
        handleSetEditing(true);
      }
    },
    [isInternalEditing, handleSetEditing],
  );

  // Add keydown event listener to handle enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          // Reset the internal value to the original value
          setInternalValue(value);
          internalValueRef.current = value;
          handleSetEditing(false);
          inputRef.current?.blur();
          break;
        case 'Enter':
          handleSetEditing(false);
          onChange(internalValueRef.current.trim());
          inputRef.current?.blur();
          break;
      }
    };
    if (isInternalEditing) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInternalEditing, onChange, handleSetEditing, value]);

  return (
    <Input
      ref={inputRef}
      className={cn(
        'disabled:opacity-1 w-full rounded-sm border-transparent px-1 py-0',
        'focus:outline-none disabled:cursor-text',
        {
          'focus:border-blue-500 focus:ring-blue-500': isInternalEditing,
          'select-none bg-transparent': !isInternalEditing,
          truncate: !isInternalEditing,
        },
        className,
      )}
      style={{
        caretColor: isInternalEditing ? undefined : 'transparent',
      }}
      value={internalValue}
      onChange={handleSetValue}
      onBlur={handleBlur}
      disabled={isReadOnly}
      onClick={editTrigger === 'click' ? handleClick : undefined}
      onDoubleClick={editTrigger === 'doubleClick' ? handleClick : undefined}
      placeholder={
        !isInternalEditing ? (placeholder ?? 'Click to edit') : undefined
      }
    />
  );
};
