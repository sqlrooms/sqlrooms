import {Button, cn} from '@sqlrooms/ui';
import {FileCodeCornerIcon} from 'lucide-react';
import {FC} from 'react';
import {useMarkdownDocumentEditorContext} from './MarkdownDocumentEditorContext';
import {RichToolbar} from './RichToolbar';

export type MarkdownDocumentEditorToolbarProps = {
  className?: string;
};

export const MarkdownDocumentEditorToolbar: FC<
  MarkdownDocumentEditorToolbarProps
> = ({className}) => {
  const {editor, sourcePanelOpen, setSourcePanelOpen, readOnly} =
    useMarkdownDocumentEditorContext();

  return (
    <div
      className={cn(
        'border-border flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2',
        className,
      )}
    >
      <RichToolbar editor={editor} disabled={readOnly} />
      <div className="flex-1" />
      <Button
        type="button"
        size="icon"
        variant={sourcePanelOpen ? 'secondary' : 'ghost'}
        className="h-8 gap-2"
        aria-pressed={sourcePanelOpen}
        title={
          sourcePanelOpen ? 'Hide Markdown source' : 'Show Markdown source'
        }
        onClick={() => setSourcePanelOpen(!sourcePanelOpen)}
      >
        <FileCodeCornerIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
