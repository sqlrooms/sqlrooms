import {
  cn,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {BrowserView} from './BrowserView';
import {CodeView} from './CodeView';
import {FileTreeView} from './filetree/FileTreeView';
import {TerminalView} from './TerminalView';

export function WebContainerWorkbench(props: {className?: string}) {
  return (
    <div className={cn('flex h-full w-full', props.className)}>
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
      </ResizablePanelGroup>
    </div>
  );
}
