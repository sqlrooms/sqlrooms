import {RoomShell} from '@sqlrooms/room-shell';
import {
  Button,
  ThemeSwitch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {TerminalIcon} from 'lucide-react';
import {DbConnectionsSection} from './DbConnectionsSection';

export function CliSidebarFooterControls({
  onToggleSqlEditor,
}: {
  onToggleSqlEditor: () => void;
}) {
  return (
    <div className="grid gap-2 group-data-[collapsible=icon]:justify-items-center group-data-[collapsible=icon]:gap-1">
      <DbConnectionsSection />
      <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8"
              onClick={onToggleSqlEditor}
            >
              <TerminalIcon className="h-4 w-4" />
              <span className="sr-only">SQL Editor</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">SQL Editor</TooltipContent>
        </Tooltip>
        <RoomShell.CommandPalette.Button className="text-muted-foreground hover:bg-sidebar-accent hover:text-primary size-8 rounded-md" />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hover:bg-sidebar-accent flex size-8 items-center justify-center rounded-md">
              <ThemeSwitch className="data-[state=checked]:bg-primary/30 data-[state=unchecked]:bg-sidebar-accent" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Toggle theme</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
