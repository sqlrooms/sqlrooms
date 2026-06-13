import {DbSettings, useStoreWithDbSettings} from '@sqlrooms/db-settings';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from '@sqlrooms/ui';
import {HousePlugIcon} from 'lucide-react';
import {useMemo} from 'react';

export function DbConnectionsSection() {
  const {state} = useSidebar();
  const missingDriverCount = useMissingDriverCount();

  return (
    <Dialog>
      {state === 'expanded' ? (
        <DialogTrigger asChild>
          <button
            type="button"
            className="bg-sidebar-accent/35 border-sidebar-border hover:bg-sidebar-accent focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left outline-none focus-visible:ring-2"
            aria-label="Database connections"
          >
            <div className="min-w-0">
              <div className="text-sidebar-foreground text-sm font-medium">
                Connections
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {missingDriverCount > 0
                  ? `${missingDriverCount} driver${
                      missingDriverCount > 1 ? 's' : ''
                    } missing`
                  : 'Local and bridged databases'}
              </div>
            </div>
            <HousePlugIcon
              className="text-muted-foreground h-4 w-4 shrink-0"
              aria-hidden
            />
          </button>
        </DialogTrigger>
      ) : (
        <DbConnectionsTriggerButton
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md"
          missingDriverCount={missingDriverCount}
        />
      )}

      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Database Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="connections"
          className="flex min-h-0 w-full flex-col"
        >
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="connections" className="flex-1">
              Connections
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex-1">
              <DbSettings.DriversTabLabel />
            </TabsTrigger>
          </TabsList>
          <div className="mt-4 grid min-h-0 overflow-y-auto [&>*]:col-start-1 [&>*]:row-start-1">
            <TabsContent
              value="connections"
              forceMount
              className="space-y-4 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
            >
              <DbSettings.Connections />
            </TabsContent>
            <TabsContent
              value="drivers"
              forceMount
              className="data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
            >
              <DbSettings.Diagnostics />
            </TabsContent>
          </div>
          <TabsContent
            value="connections"
            forceMount
            className="flex shrink-0 justify-end pt-4 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
          >
            <DbSettings.SaveButton />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DbConnectionsTriggerButton({
  className,
  missingDriverCount,
}: {
  className?: string;
  missingDriverCount: number;
}) {
  const tooltipLabel =
    missingDriverCount > 0
      ? `DB connections (${missingDriverCount} driver${
          missingDriverCount > 1 ? 's' : ''
        } missing)`
      : 'DB connections';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DialogTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={className}
            aria-label="Database connections"
          >
            <HousePlugIcon className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </TooltipTrigger>
      <TooltipContent side="left">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

function useMissingDriverCount() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );

  return useMemo(
    () => diagnostics.filter((diagnostic) => !diagnostic.available).length,
    [diagnostics],
  );
}
