import {useCallback, type FC} from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

export type BlockCaptionEditorProps = {
  className?: string;
  value?: string;
  placeholder?: string;
  isReadOnly?: boolean;
  onChange: (value: string) => void;
};

/**
 * Editable caption field shared across document blocks (charts, maps,
 * queries, etc.). Keeps caption styling and editing behavior consistent
 * regardless of which block renders it.
 *
 * @param value - Current caption text
 * @param className - Optional CSS class name
 * @param placeholder - Placeholder text when empty
 * @param isReadOnly - Whether the caption is editable
 * @param onChange - Callback when the caption changes. A commit that leaves the
 *   caption unchanged is swallowed, so merely focusing and leaving the field
 *   never dirties the surrounding document.
 */
export const BlockCaptionEditor: FC<BlockCaptionEditorProps> = ({
  value,
  className,
  placeholder,
  isReadOnly,
  onChange,
}) => {
  // EditableText commits on every blur, edited or not. Without this guard a
  // stray click into the caption would push an undo step and mark the document
  // dirty for no edit at all.
  const handleChange = useCallback(
    (next: string) => {
      if (next === (value ?? '')) return;
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <EditableText
      className={cn(
        'h-8 min-w-0 flex-1 border-0 text-sm font-medium shadow-none focus:border-transparent focus:ring-0',
        className,
      )}
      value={value ?? ''}
      placeholder={placeholder}
      isReadOnly={isReadOnly}
      onChange={handleChange}
    />
  );
};
