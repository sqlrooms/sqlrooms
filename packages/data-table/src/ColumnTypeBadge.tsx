import {ColumnTypeCategory} from '@sqlrooms/duckdb';
import {
  CopyButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@sqlrooms/ui';
import {FC} from 'react';

/**∏
 * A badge that displays the type of a database table column.
 */
export const ColumnTypeBadge: FC<{
  className?: string;
  columnType: unknown;
  typeCategory?: ColumnTypeCategory;
}> = ({className, columnType, typeCategory}) => {
  const label = String(columnType);
  const shouldShowPopover = label.length > 10;

  const badge = (
    <div
      className={cn(
        'flex h-5 items-center justify-center',
        'w-[55px] shrink-0 overflow-hidden rounded-sm px-1 py-0.25 text-[9px]',
        'cursor-default lowercase',
        {
          'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400':
            !typeCategory,
          'bg-blue-100 text-blue-500 dark:bg-blue-900 dark:text-blue-400':
            typeCategory === 'string',
          'bg-green-100 text-green-500 dark:bg-green-900 dark:text-green-400':
            typeCategory === 'number',
          'bg-yellow-100 text-yellow-500 dark:bg-yellow-900 dark:text-yellow-400':
            typeCategory === 'datetime',
          'bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-400':
            typeCategory === 'boolean',
          'bg-orange-100 text-orange-400 dark:bg-orange-900 dark:text-orange-400':
            typeCategory === 'binary' || typeCategory === 'geometry',
          'bg-purple-100 text-purple-500 dark:bg-purple-900 dark:text-purple-400':
            typeCategory === 'json' || typeCategory === 'struct',
        },
        className,
      )}
    >
      <span className="block w-full min-w-0 truncate text-center whitespace-nowrap">
        {label}
      </span>
    </div>
  );

  if (!shouldShowPopover) {
    return badge;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent className="wrap-break-words relative max-w-[200px] font-mono text-xs whitespace-pre-wrap">
        <CopyButton
          text={label}
          className="bg-background absolute top-2 right-2 mr-2"
        />
        {label}
      </PopoverContent>
    </Popover>
  );
};
