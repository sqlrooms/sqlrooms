import type {BlocksDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {MosaicDashboard} from '@sqlrooms/mosaic';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const AnalysisDashboardBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlocksDocumentStatefulBlockRendererProps) => {
  const ensureDashboard = useRoomStore(
    (state) => state.mosaicDashboard.ensureDashboard,
  );

  useEffect(() => {
    if (blockType === 'dashboard' && blockInstanceId) {
      ensureDashboard(blockInstanceId, title ?? 'Embedded Dashboard');
    }
  }, [blockInstanceId, blockType, ensureDashboard, title]);

  if (!blockInstanceId || blockType !== 'dashboard') {
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
        <MosaicDashboard dashboardId={blockInstanceId} />
      </div>
    </div>
  );
};
