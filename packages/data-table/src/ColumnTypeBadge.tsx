import {ColumnTypeCategory} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';

/**∏
 * A badge that displays the type of a database table column.
 */
export const ColumnTypeBadge: FC<{
  className?: string;
  columnType: unknown;
  typeCategory?: ColumnTypeCategory;
}> = ({className, columnType, typeCategory}) => (
  <div
    title={String(columnType)}
    className={cn(
      'h-5 items-center justify-center',
      'py-0.25 w-[55px] flex-shrink-0 overflow-hidden text-ellipsis rounded-sm px-1 text-center text-[9px]',
      'cursor-default whitespace-nowrap lowercase',
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
    {String(columnType)}
  </div>
);
