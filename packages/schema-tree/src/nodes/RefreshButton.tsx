import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {RefreshCwIcon} from 'lucide-react';
import {FC, useCallback, useEffect, useRef, useState} from 'react';

const MIN_SPIN_MS = 500;

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

  const [minSpinActive, setMinSpinActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinning = isRefreshingTableSchemas || minSpinActive;

  const handleClick = useCallback(
    (evt: React.MouseEvent) => {
      evt.preventDefault();
      setMinSpinActive(true);
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMinSpinActive(false), MIN_SPIN_MS);
      refreshTableSchemas();
    },
    [refreshTableSchemas],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', className)}
          onClick={handleClick}
        >
          <RefreshCwIcon
            className={cn(
              'text-muted-foreground h-4 w-4',
              spinning ? 'animate-spin' : '',
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
