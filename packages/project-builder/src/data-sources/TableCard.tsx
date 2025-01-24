import {Badge, cn} from '@sqlrooms/ui';
import {DataTable} from '@sqlrooms/duckdb';
import {formatNumber} from '@sqlrooms/utils';
import {FC} from 'react';

export type Props = {
  isReadOnly?: boolean;
  value?: DataTable;
  rowCount?: number;
  onReset?: () => void;
  onClick?: () => void;
  className?: string;
};

const TableCard: FC<Props> = ({value, rowCount, onClick, className}) => {
  if (!value) return null;

  return (
    <div
      className={cn(
        `flex flex-col border border-border bg-card rounded-sm py-2 px-2 items-center justify-center relative cursor-pointer transition-colors hover:border-foreground`,
        className,
      )}
      onClick={onClick}
    >
      <div className="flex gap-2 px-2 mt-0 flex-col w-full">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <td className="pr-6">
                  <div className="h-[30px] overflow-hidden relative">
                    <div className="absolute w-full text-foreground mb-1 py-1 whitespace-nowrap text-ellipsis overflow-hidden font-bold">
                      {value.tableName}
                    </div>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              {value.columns?.map((row, i) => {
                return (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-[60px]">
                          <Badge
                            variant="outline"
                            className="opacity-50 text-[0.6rem]"
                          >
                            {row.type}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-xs max-w-[100px]">
                          {row.name}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-xs text-right mt-1">
            {`${formatNumber(value.rowCount ?? rowCount ?? NaN)} rows`}
          </div>
        </div>
      </div>
    </div>
  );
};

export {TableCard};
