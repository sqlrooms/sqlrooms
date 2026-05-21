import {MarkdownDocumentEditor} from '@sqlrooms/documents';
import {Button} from '@sqlrooms/ui';
import {ALargeSmallIcon, FileTextIcon} from 'lucide-react';
import {type FC, useCallback} from 'react';
import type {TextPanel} from '../dashboard/dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
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

  const toolbarOpen = panel.config.toolbarOpen ?? false;

  const handleChange = useCallback(
    (value: string) => {
      updatePanel(dashboardId, panel.id, {
        config: {
          ...panel.config,
          content: value,
        },
      });
    },
    [dashboardId, panel.id, panel.config, updatePanel],
  );

  const handleSourcePanelOpenChange = useCallback(
    (open: boolean) => {
      updatePanel(dashboardId, panel.id, {
        config: {
          ...panel.config,
          sourcePanelOpen: open,
        },
      });
    },
    [dashboardId, panel.id, panel.config, updatePanel],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MarkdownDocumentEditor
        value={panel.config.content}
        onChange={handleChange}
        sourcePanelOpen={panel.config.sourcePanelOpen}
        onSourcePanelOpenChange={handleSourcePanelOpenChange}
      >
        {toolbarOpen ? <MarkdownDocumentEditor.Toolbar /> : null}
        <MarkdownDocumentEditor.Content />
      </MarkdownDocumentEditor>
    </div>
  );
};

const TextPanelHeaderActions: FC<TextPanelRendererProps> = ({
  dashboardId,
  panel,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const toolbarOpen = panel.config.toolbarOpen ?? false;

  const handleToggleToolbar = useCallback(() => {
    updatePanel(dashboardId, panel.id, {
      config: {
        ...panel.config,
        toolbarOpen: !toolbarOpen,
      },
    });
  }, [dashboardId, panel.id, panel.config, toolbarOpen, updatePanel]);

  return (
    <Button
      variant={toolbarOpen ? 'secondary' : 'ghost'}
      size="icon"
      className="h-6 w-6"
      aria-label="Toggle formatting toolbar"
      onClick={handleToggleToolbar}
    >
      <ALargeSmallIcon className="h-3.5 w-3.5" />
    </Button>
  );
};

export const mosaicDashboardTextRenderer: MosaicDashboardPanelRenderer<TextPanel> =
  {
    component: MosaicDashboardTextRenderer,
    icon: FileTextIcon,
    headerActions: TextPanelHeaderActions,
  };
