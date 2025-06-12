import {RoomStateProviderProps, RoomStateProvider} from '@sqlrooms/core';
import {Toaster, TooltipProvider} from '@sqlrooms/ui';
import {BaseRoomConfig} from '@sqlrooms/room-config';

/**
 * Provider for the room shell.
 * @param props - The props for the provider.
 * @returns The provider for the room shell.
 */
export function RoomShellProvider<PC extends BaseRoomConfig>({
  children,
  roomStore,
}: RoomStateProviderProps<PC>) {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </RoomStateProvider>
  );
}
