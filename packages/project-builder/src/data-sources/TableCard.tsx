import {
  Badge,
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {DataTable} from '@sqlrooms/duckdb';
import {formatNumber} from '@sqlrooms/utils';
import {EllipsisIcon} from 'lucide-react';
import {FC} from 'react';

export type TableAction = {
  icon: React.FC<{className: string}>;
  label: string;
  onClick: (tableName: string) => void;
};
const TableCard: FC<{
  isReadOnly?: boolean;
  value?: DataTable;
  rowCount?: number;
  onReset?: () => void;
  onClick?: () => void;
  className?: string;
  tableActions?: TableAction[];
}> = ({value, rowCount, onClick, className, tableActions}) => {
  if (!value) return null;

  const numRows = value.rowCount ?? rowCount;
  return (
    <Card
      className={cn(
        `hover:border-foreground relative flex cursor-pointer flex-col items-center justify-center rounded-sm border px-2 py-2 transition-colors`,
        className,
      )}
      onClick={onClick}
    >
      <div className="mt-0 flex w-full flex-col gap-2 px-2">
        <div className="w-full overflow-auto">
          <div className="relative mb-2 h-[30px] overflow-hidden flex cursor-pointer flex-row items-center gap-1">
            <div className="text-foreground mb-1 overflow-hidden text-ellipsis whitespace-nowrap py-1 font-mono text-sm font-bold flex-1">
              {value.tableName}
            </div>
            {tableActions ? <div className="flex-none">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground h-6 w-6"
                >
                  <EllipsisIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tableActions.map((action, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(value.tableName)
                    }}
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div> : null}
          </div>
          <div className="flex flex-col gap-1">
            {value.columns?.map((row, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className="hover:bg-foreground/10 flex items-center gap-3 rounded-sm font-mono">
                    <Badge
                      variant="secondary"
                      className="text-muted-foreground w-[70px] overflow-hidden whitespace-nowrap px-1 py-0 text-xs"
                    >
                      {row.type}
                    </Badge>
                    <div className="max-w-[100px] text-xs">{row.name}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[250px]"
                  side="right"
                  align="center"
                >
                  <div className="flex flex-col gap-1 font-mono">
                    <div className="text-sm font-bold">{row.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {row.type}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {numRows !== undefined && Number.isFinite(numRows) && (
            <div className="mt-1 text-right text-xs">
              {`${formatNumber(numRows)} rows`}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export {TableCard};
