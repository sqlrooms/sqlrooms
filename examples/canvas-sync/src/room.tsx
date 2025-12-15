import {RoomShell, RoomShellSidebarButtons} from '@sqlrooms/room-shell';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  ThemeSwitch,
} from '@sqlrooms/ui';
import {Zap, ZapOff} from 'lucide-react';
import {InputApiKey} from './InputApiKey';
import {roomStore, useRoomStore} from './store';

type ConnectionStatusVisual = {
  label: string;
  colorClass: string;
};

const CONNECTION_STATUS: Record<string, ConnectionStatusVisual> = {
  open: {label: 'Connected', colorClass: 'text-emerald-500'},
  connecting: {label: 'Connecting', colorClass: 'text-amber-500'},
  closed: {label: 'Disconnected', colorClass: 'text-rose-500'},
  error: {label: 'Error', colorClass: 'text-rose-600'},
  idle: {label: 'Idle', colorClass: 'text-muted-foreground'},
};

function ConnectionStatusIndicator() {
  const status = useRoomStore((s) => s.connection);
  const visual = CONNECTION_STATUS[status] ?? CONNECTION_STATUS.idle;
  const Icon = status === 'open' ? Zap : ZapOff;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon
              className={`h-3 w-3 ${visual.colorClass}`}
              fill="currentColor"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-xs">CRDT WebSocket: {status}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Room() {
  return (
    <RoomShell className="h-screen w-screen" roomStore={roomStore}>
      <div className="flex h-full w-12 flex-col items-center gap-2 bg-muted/70 px-1 py-4">
        <ConnectionStatusIndicator />
        <RoomShellSidebarButtons />
        <div className="flex items-center justify-between gap-3 pr-2">
          <ThemeSwitch />
        </div>
      </div>
      <RoomShell.LayoutComposer tileClassName="p-0" />
      {/* <RoomShell.LoadingProgress /> */}
      <InputApiKey className="absolute right-[60px] top-5 z-10" />
    </RoomShell>
  );
}
