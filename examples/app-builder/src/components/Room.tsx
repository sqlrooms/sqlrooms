import {RoomStateProvider} from '@sqlrooms/room-store';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {BrowserView} from './BrowserView';
import {CodeView} from './CodeView';
import {roomStore} from '../store/store';
import {TerminalView} from './TerminalView';
import {FileTreeView} from './filetree/FileTreeView';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <div className="flex h-full w-full">
        <ResizablePanelGroup direction="horizontal">
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
          {/* <AssistantView /> */}
        </ResizablePanelGroup>
      </div>
    </RoomStateProvider>
  );
};
