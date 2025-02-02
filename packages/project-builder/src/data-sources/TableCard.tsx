import {Badge, cn, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {DataTable} from '@sqlrooms/duckdb';
import {formatNumber} from '@sqlrooms/utils';
import {FC} from 'react';

const TableCard: FC<{
  isReadOnly?: boolean;
  value?: DataTable;
  rowCount?: number;
  onReset?: () => void;
  onClick?: () => void;
  className?: string;
}> = ({value, rowCount, onClick, className}) => {
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
        <div className="overflow-auto w-full">
          <div className="h-[30px] overflow-hidden relative mb-2">
            <div className="absolute w-full text-foreground mb-1 py-1 whitespace-nowrap text-ellipsis overflow-hidden font-bold font-mono">
              {value.tableName}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {value.columns?.map((row, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 hover:bg-foreground/10 rounded-sm font-mono">
                    <Badge
                      variant="secondary"
                      className="text-xs overflow-hidden whitespace-nowrap py-0 px-1 w-[70px] text-muted-foreground"
                    >
                      {row.type}
                    </Badge>
                    <div className="text-xs max-w-[100px]">{row.name}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[250px]"
                  side="right"
                  align="center"
                >
                  <div className="flex flex-col gap-1 font-mono">
                    <div className="text-sm font-bold">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.type}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="text-xs text-right mt-1">
            {`${formatNumber(value.rowCount ?? rowCount ?? NaN)} rows`}
          </div>
        </div>
      </div>
    </div>
  );
};

export {TableCard};
