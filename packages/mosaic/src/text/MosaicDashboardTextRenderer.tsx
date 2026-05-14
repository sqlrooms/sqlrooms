import {MarkdownDocumentEditor} from '@sqlrooms/documents';
import {FileTextIcon} from 'lucide-react';
import {type FC, useCallback} from 'react';
import {
  type MosaicDashboardPanelRenderer,
  type TextPanel,
  type TextPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';

const MosaicDashboardTextRenderer: FC<TextPanelRendererProps> = ({
  dashboardId,
  panel,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const handleChange = useCallback(
    (value: string) => {
      updatePanel(dashboardId, panel.id, {
        config: {
          content: value,
        },
      });
    },
    [dashboardId, panel.id, updatePanel],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarkdownDocumentEditor
        value={panel.config.content}
        onChange={handleChange}
      >
        <MarkdownDocumentEditor.Toolbar />
        <MarkdownDocumentEditor.Content />
      </MarkdownDocumentEditor>
    </div>
  );
};

export const mosaicDashboardTextRenderer: MosaicDashboardPanelRenderer<TextPanel> =
  {
    component: MosaicDashboardTextRenderer,
    icon: FileTextIcon,
  };
