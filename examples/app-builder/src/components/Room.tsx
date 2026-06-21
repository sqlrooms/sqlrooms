import {RoomStateProvider} from '@sqlrooms/room-store';
import {
  ResizablePanel,
  ResizablePanelGroup,
  Toaster,
  TooltipProvider,
} from '@sqlrooms/ui';
import {WebContainer} from '@sqlrooms/webcontainer';
import {roomStore} from '../store/store';
import {AssistantView} from './AssistantView';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <TooltipProvider>
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="30">
            <AssistantView />
          </ResizablePanel>
          <ResizablePanel>
            <WebContainer.Workbench />
          </ResizablePanel>
        </ResizablePanelGroup>
        <Toaster />
      </TooltipProvider>
    </RoomStateProvider>
  );
};
