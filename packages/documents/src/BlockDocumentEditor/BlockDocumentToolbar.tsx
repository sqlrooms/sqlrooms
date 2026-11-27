import {Button, cn} from '@sqlrooms/ui';
import {type FC, type ReactNode, useState} from 'react';
import {RichToolbar} from '../MarkdownDocumentEditor/RichToolbar';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';
import {insertBlockDocumentItem} from './BlockDocumentInsertItems';
import {useBlockDocumentInsertItems} from './useBlockDocumentInsertItems';

/** Props for {@link BlockDocumentToolbar}. */
export type BlockDocumentToolbarProps = {
  className?: string;
  /**
   * Toolbar contents. When omitted, the default layout is rendered:
   * formatting controls, a separator, then insert buttons for the
   * `'paragraph'`, `'image'` and `'chart'` items (each only if present in the
   * editor's `insertItems`).
   */
  children?: ReactNode;
};

/** Props for {@link BlockDocumentToolbarInsertButton}. */
export type BlockDocumentToolbarInsertButtonProps = {
  /** Id of the insert item in the editor's `insertItems`, e.g. `'chart'`. */
  itemId: string;
  className?: string;
};

/**
 * Text formatting controls (marks, headings, lists…) for the block editor.
 * Reads the editor and `readOnly` from the editor context.
 */
export const BlockDocumentToolbarFormatting: FC = () => {
  const {editor, readOnly} = useBlockDocumentEditorContext();
  return <RichToolbar editor={editor} disabled={readOnly} />;
};

/** Vertical divider between toolbar groups. */
export const BlockDocumentToolbarSeparator: FC<{className?: string}> = ({
  className,
}) => <div className={cn('bg-border mx-1 h-6 w-px', className)} />;

/**
 * Icon button that inserts the editor's insert item with id `itemId` at the
 * selection, through the same path as the block menu and slash search (so an
 * async `createNode` and a `null` cancel behave the same). Renders nothing
 * when no item has that id. Disabled while read-only or while its insert is
 * pending.
 */
export const BlockDocumentToolbarInsertButton: FC<
  BlockDocumentToolbarInsertButtonProps
> = ({itemId, className}) => {
  const {editor, readOnly, generateBlockId} = useBlockDocumentEditorContext();
  const insertItems = useBlockDocumentInsertItems();
  const [pending, setPending] = useState(false);
  const item = insertItems.find((candidate) => candidate.id === itemId);
  if (!item) return null;

  const title = `Insert ${item.label.toLowerCase()}`;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn('h-8 w-8', className)}
      disabled={!editor || readOnly || pending}
      title={title}
      aria-label={title}
      onClick={() => {
        if (!editor) return;
        const result = insertBlockDocumentItem({
          editor,
          item,
          nodeId: generateBlockId(),
          target: {kind: 'selection'},
        });
        if (!result) return;
        setPending(true);
        void result.finally(() => setPending(false));
      }}
    >
      <item.icon className="h-4 w-4" />
    </Button>
  );
};

/** Item ids of the default layout's insert buttons, in order. */
const DEFAULT_INSERT_BUTTON_IDS = ['paragraph', 'image', 'chart'];

const BlockDocumentToolbarRoot: FC<BlockDocumentToolbarProps> = ({
  className,
  children,
}) => (
  <div
    role="toolbar"
    aria-label="Document toolbar"
    className={cn(
      'border-border flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2',
      className,
    )}
  >
    {children ?? (
      <>
        <BlockDocumentToolbarFormatting />
        <BlockDocumentToolbarSeparator />
        {DEFAULT_INSERT_BUTTON_IDS.map((id) => (
          <BlockDocumentToolbarInsertButton key={id} itemId={id} />
        ))}
      </>
    )}
  </div>
);

/**
 * Toolbar for the block editor, as a compound component. With no children it
 * renders the default layout; with children it renders only those, inside the
 * toolbar container. Host buttons can read the editor through
 * `useBlockDocumentEditorContext()`.
 *
 * @example
 * <BlockDocumentEditor.Toolbar>
 *   <BlockDocumentEditor.Toolbar.Formatting />
 *   <BlockDocumentEditor.Toolbar.Separator />
 *   <BlockDocumentEditor.Toolbar.InsertButton itemId="chart" />
 *   <MyHostButton />
 * </BlockDocumentEditor.Toolbar>
 */
export const BlockDocumentToolbar = Object.assign(BlockDocumentToolbarRoot, {
  Formatting: BlockDocumentToolbarFormatting,
  Separator: BlockDocumentToolbarSeparator,
  InsertButton: BlockDocumentToolbarInsertButton,
});
