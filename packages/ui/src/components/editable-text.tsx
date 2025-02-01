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

const EDITING_PAD = 12;

export const EditableText: FC<{
  className?: string;
  isReadOnly?: boolean;
  value: string;
  minWidth?: number;
  maxWidth?: number;
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
  minWidth = 100,
  maxWidth = 500,
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
  internalValueRef.current = internalValue;

  const [inputWidth, setInputWidth] = useState(minWidth);
  const spanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Update input width based on the invisible span width
    setInputWidth(spanRef.current?.offsetWidth ?? 0);
  }, [internalValue]);

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

  const handleClick = useCallback(() => {
    if (!isInternalEditing) {
      handleSetEditing(true);
    }
  }, [isInternalEditing, handleSetEditing]);

  useEffect(() => {
    if (value !== internalValueRef.current) {
      setInternalValue(value);
    }
  }, [value]);
  useEffect(() => {
    if (isEditing !== undefined && isEditing !== isInternalEditing) {
      setInternalIsEditing(Boolean(isEditing));
      if (isEditing) {
        setTimeout(() => {
          // When enabling editing from a dropdown menu, there will be a blur event when the dropdown closes,
          // so we need to wait a bit before making sure the input is focused and selected
          inputRef.current?.select();
          inputRef.current?.focus();
        }, 200);
      }
    }
  }, [isInternalEditing, handleSetEditing, isEditing]);

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
    <>
      {/* Hidden span to measure the input width, so that the we can make the input grow to fit the text */}
      <span
        ref={spanRef}
        className={cn(
          className,
          'white-space-pre pointer-events-none invisible absolute left-0 top-0 px-1',
        )}
        style={{minWidth, maxWidth}}
      >
        {internalValue}
      </span>
      <Input
        ref={inputRef}
        className={cn(
          'disabled:opacity-1 rounded-sm border-transparent px-1 py-0 focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-text',
          {'select-none bg-transparent': !isInternalEditing},
          className,
        )}
        style={{
          width: inputWidth + EDITING_PAD, // add padding to avoid jittering when editing
          caretColor: isInternalEditing ? undefined : 'transparent',
        }}
        value={internalValue}
        onChange={handleSetValue}
        onBlur={handleBlur}
        disabled={isReadOnly}
        onClick={handleClick}
        placeholder={
          !isInternalEditing ? (placeholder ?? 'Click to edit') : undefined
        }
      />
    </>
  );
};
