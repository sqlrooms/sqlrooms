import {RoomStateProvider} from '@sqlrooms/room-store';
import {ResizablePanel, ResizablePanelGroup} from '@sqlrooms/ui';
import {WebContainer} from '@sqlrooms/webcontainer';
import {roomStore} from '../store/store';
import {AssistantView} from './AssistantView';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30}>
          <AssistantView />
        </ResizablePanel>
        <ResizablePanel>
          <WebContainer.Workbench />
        </ResizablePanel>
      </ResizablePanelGroup>
    </RoomStateProvider>
  );
};
