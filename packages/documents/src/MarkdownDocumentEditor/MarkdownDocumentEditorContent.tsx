import {markdown} from '@codemirror/lang-markdown';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {
  Button,
  cn,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import {FileCodeCornerIcon, XIcon} from 'lucide-react';
import {FC, useEffect, useRef} from 'react';
import {useMarkdownDocumentEditorContext} from './MarkdownDocumentEditorContext';

export type MarkdownDocumentEditorContentProps = {
  className?: string;
};

export const MarkdownDocumentEditorContent: FC<
  MarkdownDocumentEditorContentProps
> = ({className}) => {
  const {
    editor,
    value,
    onChange,
    sourcePanelOpen,
    setSourcePanelOpen,
    readOnly,
  } = useMarkdownDocumentEditorContext();

  const panelRef = useRef<ResizablePanelHandle>(null);

  useEffect(() => {
    if (sourcePanelOpen) {
      panelRef.current?.expand();
    } else {
      panelRef.current?.collapse();
    }
  }, [sourcePanelOpen]);

  return (
    <div className={cn('flex min-h-0 flex-1', className)}>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel minSize={20}>
          <EditorContent editor={editor} className="h-full overflow-auto" />
        </ResizablePanel>
        <ResizableHandle className="w-px" />
        <ResizablePanel
          ref={panelRef}
          minSize="30%"
          maxSize="50%"
          collapsible={true}
          collapsedSize={0}
          className="overflow-auto"
        >
          <div className="flex h-full flex-col">
            <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <FileCodeCornerIcon className="text-muted-foreground h-4 w-4" />
              <div className="flex-1" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Hide Markdown source"
                title="Hide Markdown source"
                onClick={() => setSourcePanelOpen(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <CodeMirrorEditor
              className="h-full min-h-0 flex-1"
              value={value}
              readOnly={readOnly}
              onChange={onChange}
              extensions={[markdown(), createSqlroomsTheme()]}
              options={{
                lineNumbers: false,
                lineWrapping: true,
                foldGutter: false,
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
