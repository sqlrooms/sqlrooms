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
} from '@sqlrooms/ui';
import {HousePlugIcon} from 'lucide-react';
import {useMemo} from 'react';

export function DbConnectionsSection() {
  const missingDriverCount = useMissingDriverCount();

  return (
    <Dialog>
      <DbConnectionsTriggerButton
        className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md"
        missingDriverCount={missingDriverCount}
      />

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
      <TooltipContent side="right">{tooltipLabel}</TooltipContent>
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
