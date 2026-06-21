import type {FC, PropsWithChildren} from 'react';

export type FieldProps = PropsWithChildren<{
  label: string;
  required?: boolean;
}>;

/**
 * Layout wrapper that provides a label and grid container for horizontal
 * arrangement of child selectors (e.g., ColumnSelector, TemporalGranularitySelector).
 */
export const Field: FC<FieldProps> = ({label, required, children}) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium">
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
