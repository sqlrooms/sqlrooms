import {cn} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import type {FC} from 'react';
import {optionalString, unknownRecord} from './nodeViewUtils';

type AnalysisRichTextNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
};

export const AnalysisRichTextNodeView: FC<AnalysisRichTextNodeViewProps> = ({
  node,
  selected,
}) => {
  const attrs = unknownRecord(node.attrs);
  const markdown = optionalString(attrs.markdown);

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-muted/30 my-3 rounded-md border px-3 py-2',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
    >
      <div className="text-muted-foreground mb-1 text-xs font-medium">
        Rich text block
      </div>
      <pre className="text-foreground m-0 bg-transparent p-0 text-sm whitespace-pre-wrap">
        {markdown ?? ''}
      </pre>
    </NodeViewWrapper>
  );
};
