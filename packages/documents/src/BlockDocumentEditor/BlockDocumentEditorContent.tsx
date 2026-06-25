import {cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import type {FC} from 'react';
import {useCallback, useState} from 'react';
import {BlockDocumentBlockControls} from './BlockDocumentBlockControls';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';
import {useBlockSettingsStore} from '../block-settings/useBlockSettingsStore';

export type BlockDocumentEditorContentProps = {
  className?: string;
};

export const BlockDocumentEditorContent: FC<
  BlockDocumentEditorContentProps
> = ({className}) => {
  const {editor} = useBlockDocumentEditorContext();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const clearSelection = useBlockSettingsStore(
    (state) => state.blockSettings.clearSelection,
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Clear selection if clicking on the editor background (not on a block)
      const target = e.target as HTMLElement;
      if (target.classList.contains('ProseMirror')) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  return (
    <div
      ref={setScrollElement}
      className={cn('relative h-full min-h-0 flex-1 overflow-auto', className)}
      onClick={handleClick}
    >
      <EditorContent editor={editor} className="min-h-full" />
      <BlockDocumentBlockControls scrollElement={scrollElement} />
    </div>
  );
};
