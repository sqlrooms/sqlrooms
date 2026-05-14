import {markdown} from '@codemirror/lang-markdown';
import {CodeMirrorEditor, createSqlroomsTheme} from '@sqlrooms/codemirror';
import {Button, cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import {FileCodeCornerIcon, XIcon} from 'lucide-react';
import {FC} from 'react';
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

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col lg:flex-row', className)}>
      <EditorContent
        editor={editor}
        className="min-h-[320px] flex-1 overflow-auto lg:min-h-0"
      />
      {sourcePanelOpen ? (
        <div className="border-border flex min-h-[260px] flex-col border-t lg:min-h-0 lg:w-[42%] lg:min-w-[22rem] lg:border-t-0 lg:border-l">
          <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
            <FileCodeCornerIcon className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">Markdown</span>
            <div className="flex-1" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
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
      ) : null}
    </div>
  );
};
