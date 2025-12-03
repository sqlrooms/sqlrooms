import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {useRef} from 'react';
import {createRoomStore} from '../store/store';
import {AssistantView} from './AssistantView';
import {BrowserView} from './BrowserView';
import {CodeView} from './CodeView';
import {TerminalView} from './TerminalView';
import {FileTreeView} from './filetree/FileTreeView';
import {RoomStateProvider} from '@sqlrooms/room-store';

export const Room = () => {
  const storeRef = useRef<ReturnType<typeof createRoomStore>>(null);
  if (!storeRef.current) {
    storeRef.current = createRoomStore();
    storeRef.current.getState().webContainer.initialize();
  }
  return (
    <RoomStateProvider roomStore={storeRef.current}>
      <div className="flex h-full w-full">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={30}>
            <AssistantView />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={80}>
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={20}>
                    <FileTreeView />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel>
                    <CodeView />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel>
                <TerminalView />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <BrowserView />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </RoomStateProvider>
  );
};
