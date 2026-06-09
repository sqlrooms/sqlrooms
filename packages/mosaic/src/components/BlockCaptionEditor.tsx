import {FC} from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

type BlockCaptionEditorProps = {
  className?: string;
  value?: string;
  placeholder?: string;
  isReadOnly?: boolean;
  onChange: (value: string) => void;
};

/**
 * Editable caption field for blocks (charts, queries, etc.).
 *
 * @param value - Current caption text
 * @param className - Optional CSS class name
 * @param placeholder - Placeholder text when empty
 * @param isReadOnly - Whether the caption is editable
 * @param onChange - Callback when caption changes
 */
export const BlockCaptionEditor: FC<BlockCaptionEditorProps> = ({
  value,
  className,
  placeholder,
  isReadOnly,
  onChange,
}) => {
  return (
    <EditableText
      className={cn('h-8 min-w-0 flex-1 text-sm font-medium', className)}
      value={value ?? ''}
      placeholder={placeholder}
      isReadOnly={isReadOnly}
      onChange={onChange}
    />
  );
};
