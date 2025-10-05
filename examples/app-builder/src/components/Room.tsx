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
import {AssistantView} from './AssistantView';

export const Room = () => {
  return (
    <RoomStateProvider roomStore={roomStore}>
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
