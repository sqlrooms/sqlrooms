import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {PivotView} from '@sqlrooms/pivot';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const AnalysisPivotBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  const ensurePivot = useRoomStore((state) => state.pivot.ensurePivot);

  useEffect(() => {
    if (blockType === 'pivot' && blockInstanceId) {
      ensurePivot(blockInstanceId, {title: title ?? 'Embedded Pivot Table'});
    }
  }, [blockInstanceId, blockType, ensurePivot, title]);

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
        <PivotView pivotId={blockInstanceId} />
      </div>
    </div>
  );
};
