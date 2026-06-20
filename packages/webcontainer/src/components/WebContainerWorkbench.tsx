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
import type {BrowserViewProps} from './BrowserView';

export type WebContainerWorkbenchProps = {
  className?: string;
  browserViewProps?: BrowserViewProps;
};

export function WebContainerWorkbench(props: WebContainerWorkbenchProps) {
  return (
    <div className={cn('flex h-full w-full', props.className)}>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="80">
              <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel defaultSize="20">
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
          <BrowserView {...props.browserViewProps} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
