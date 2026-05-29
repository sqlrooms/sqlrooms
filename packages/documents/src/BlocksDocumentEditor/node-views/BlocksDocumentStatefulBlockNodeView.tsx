import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {createElement, type FC} from 'react';
import {useBlocksDocumentStatefulBlockRenderer} from '../../BlocksDocumentStatefulBlockRendererContext';
import {useBlocksDocumentEditorContext} from '../BlocksDocumentEditorContext';
import {optionalString, unknownRecord} from './nodeViewUtils';

type BlocksDocumentStatefulBlockNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

export const BlocksDocumentStatefulBlockNodeView: FC<
  BlocksDocumentStatefulBlockNodeViewProps
> = ({node, selected, updateAttributes}) => {
  const {documentId, readOnly} = useBlocksDocumentEditorContext();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const blockType = optionalString(attrs.blockType) ?? '';
  const blockInstanceId = optionalString(attrs.blockInstanceId) ?? blockId;
  const ownership = optionalString(attrs.ownership);
  const title = optionalString(attrs.title);
  const caption = optionalString(attrs.caption);
  const Renderer = useBlocksDocumentStatefulBlockRenderer(blockType);

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
    >
      {Renderer ? (
        createElement(Renderer, {
          documentId,
          blockId,
          blockType,
          blockInstanceId,
          ownership,
          title,
          caption,
          readOnly,
          onCaptionChange: (nextCaption: string | undefined) =>
            updateAttributes({caption: nextCaption}),
        })
      ) : (
        <div className="p-4">
          <div className="text-sm font-medium">Stateful block</div>
          <div className="text-muted-foreground mt-1 text-sm">
            No renderer is registered for {blockType || 'this block type'}.
          </div>
          <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
            <span>Block type: {blockType || 'Unconfigured'}</span>
            <span>Instance: {blockInstanceId || 'Unconfigured'}</span>
            {ownership ? <span>Ownership: {ownership}</span> : null}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};
