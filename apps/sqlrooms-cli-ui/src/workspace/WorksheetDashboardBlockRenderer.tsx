import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {MosaicDashboard} from '@sqlrooms/mosaic';
import {FC} from 'react';

export const WorksheetDashboardBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = ({blockInstanceId, blockType, caption, readOnly, headerActions}) => {
  if (!blockInstanceId || blockType !== 'dashboard') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {caption ? (
        <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <MosaicDashboard
          dashboardId={blockInstanceId}
          defaultTitle="Embedded Dashboard"
          defaultLayoutType="grid"
          headerActions={headerActions}
          selectable
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};
