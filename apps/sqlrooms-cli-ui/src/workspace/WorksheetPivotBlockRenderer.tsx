import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {PivotBlock} from '@sqlrooms/pivot';

export const WorksheetPivotBlockRenderer = ({
  blockInstanceId,
  blockType,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  if (!blockInstanceId || blockType !== 'pivot') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  return (
    <div className="flex h-[560px] min-h-[420px] flex-col">
      {caption ? (
        <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <PivotBlock
          blockId={blockInstanceId}
          blockType={blockType}
          pivotId={blockInstanceId}
          defaultTitle="Embedded Pivot Table"
        />
      </div>
    </div>
  );
};
