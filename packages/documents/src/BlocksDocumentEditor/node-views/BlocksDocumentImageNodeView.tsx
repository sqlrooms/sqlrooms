import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import type {FC} from 'react';
import {useBlocksDocumentEditorContext} from '../BlocksDocumentEditorContext';
import {
  documentAssetToDataUrl,
  optionalString,
  unknownRecord,
} from './nodeViewUtils';

type BlocksDocumentNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

type BlocksDocumentImageNodeViewProps = BlocksDocumentNodeViewProps & {
  label?: string;
};

export const BlocksDocumentImageNodeView: FC<BlocksDocumentImageNodeViewProps> = ({
  node,
  selected,
  updateAttributes,
  label = 'Image',
}) => {
  const {assets, readOnly} = useBlocksDocumentEditorContext();
  const attrs = unknownRecord(node.attrs);
  const assetId = optionalString(attrs.assetId);
  const caption = optionalString(attrs.caption);
  const asset = assetId ? assets[assetId] : undefined;
  const src = documentAssetToDataUrl(asset);

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
    >
      <figure className="m-0">
        {src ? (
          <img
            src={src}
            alt={asset?.alt ?? caption ?? label}
            className="max-h-[480px] w-full rounded-t-md object-contain"
          />
        ) : (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center px-4 text-sm">
            {assetId ? `Missing asset ${assetId}` : `${label} block`}
          </div>
        )}
        {readOnly ? (
          caption ? (
            <figcaption className="text-muted-foreground border-t px-3 py-2 text-sm">
              {caption}
            </figcaption>
          ) : null
        ) : (
          <input
            className="placeholder:text-muted-foreground w-full rounded-b-md border-0 border-t bg-transparent px-3 py-2 text-sm outline-none"
            value={caption ?? ''}
            placeholder="Caption"
            aria-label={`${label} caption`}
            onChange={(event) =>
              updateAttributes({
                caption: event.target.value || undefined,
              })
            }
          />
        )}
      </figure>
    </NodeViewWrapper>
  );
};
