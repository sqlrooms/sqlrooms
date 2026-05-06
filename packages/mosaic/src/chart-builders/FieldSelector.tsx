import type {FC, ReactNode} from 'react';

export interface FieldSelectorProps {
  label: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Layout wrapper that provides a label and grid container for horizontal
 * arrangement of child selectors (e.g., ColumnSelector, TemporalGranularitySelector).
 */
export const FieldSelector: FC<FieldSelectorProps> = ({
  label,
  required,
  children,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div
        className="grid items-end gap-2"
        style={{gridTemplateColumns: 'auto'}}
      >
        {children}
      </div>
    </div>
  );
};
