import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {RefreshCwIcon} from 'lucide-react';
import {FC} from 'react';

export const RefreshButton: FC<{
  className?: string;
  label?: string;
}> = ({className, label = 'Refresh table schemas'}) => {
  const isRefreshingTableSchemas = useStoreWithDuckDb(
    (state) => state.db.isRefreshingTableSchemas,
  );
  const refreshTableSchemas = useStoreWithDuckDb(
    (state) => state.db.refreshTableSchemas,
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', className)}
          onClick={(evt) => {
            evt.preventDefault();
            refreshTableSchemas();
          }}
        >
          <RefreshCwIcon
            className={cn(
              'text-muted-foreground h-4 w-4',
              isRefreshingTableSchemas ? 'animate-spin' : '',
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
