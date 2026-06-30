import {LeafLayout, useExpandGridPanel} from '@sqlrooms/layout';
import {useBlockSettingsStore} from '@sqlrooms/documents';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {
  ChevronsRightLeftIcon,
  GripVerticalIcon,
  MoveHorizontalIcon,
  SlidersVerticalIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  FC,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../dashboard-types';
import {
  type MosaicDashboardPanelRenderer,
  type MosaicDashboardPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../MosaicDashboardSlice';

type MosaicDashboardPanelHeaderProps = {
  dashboardId: string;
  dashboard?: MosaicDashboardEntry;
  panel?: MosaicDashboardPanelConfig;
  renderer?: MosaicDashboardPanelRenderer;
  selectionName: string;
  onSelectPanel?: () => void;
  onTitleChange?: (title: string) => void;
};

export const MosaicDashboardPanelHeader: FC<
  MosaicDashboardPanelHeaderProps
> = ({
  dashboardId,
  dashboard,
  panel,
  renderer,
  selectionName,
  onSelectPanel,
  onTitleChange,
}) => {
  const panelId = panel?.id;
  const title = panel?.title ?? 'Dashboard panel';
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const removePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.removePanel,
  );
  const {canExpandGridPanel, expandGridPanel, isGridPanelHorizontallyExpanded} =
    useExpandGridPanel();
  const requestOpenSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestOpenSettingsPanel,
  );
  const requestCloseSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestCloseSettingsPanel,
  );
  const clearSelectionIfBlockDeleted = useBlockSettingsStore(
    (state) => state.blockSettings.clearSelectionIfBlockDeleted,
  );
  const isSettingsPanelOpen = useBlockSettingsStore(
    (state) => state.blockSettings.runtime.isSettingsPanelOpen,
  );
  const isPanelSelected = useBlockSettingsStore((state) =>
    panelId
      ? state.blockSettings.isBlockSelected(
          'dashboard-panel',
          panelId,
          dashboardId,
        )
      : false,
  );
  const isSettingsShown = isSettingsPanelOpen && isPanelSelected;

  const handleRemove = useCallback(() => {
    if (!panelId) return;
    removePanel(dashboardId, panelId);
    clearSelectionIfBlockDeleted(panelId);
  }, [clearSelectionIfBlockDeleted, dashboardId, panelId, removePanel]);

  const handleHeaderClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          [
            'button',
            'a',
            'input',
            'select',
            'textarea',
            '[contenteditable="true"]',
            '[data-selectable-panel-ignore]',
          ].join(','),
        )
      ) {
        return;
      }

      onSelectPanel?.();
    },
    [onSelectPanel],
  );

  const handleSettingsClick = useCallback(() => {
    if (isSettingsShown) {
      requestCloseSettingsPanel();
      return;
    }

    onSelectPanel?.();
    requestOpenSettingsPanel();
  }, [
    isSettingsShown,
    onSelectPanel,
    requestCloseSettingsPanel,
    requestOpenSettingsPanel,
  ]);

  const handleTitleDoubleClick = useCallback(
    (event: MouseEvent<HTMLSpanElement>) => {
      if (!onTitleChange) return;

      event.preventDefault();
      event.stopPropagation();
      onSelectPanel?.();
      setDraftTitle(title);
      setIsEditingTitle(true);
    },
    [onSelectPanel, onTitleChange, title],
  );

  const handleCommitTitle = useCallback(() => {
    onTitleChange?.(draftTitle.trim());
    setIsEditingTitle(false);
  }, [draftTitle, onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleCommitTitle();
        return;
      }

      if (event.key === 'Escape') {
        setDraftTitle(title);
        setIsEditingTitle(false);
      }
    },
    [handleCommitTitle, title],
  );

  useEffect(() => {
    if (!isEditingTitle) return;

    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  const Icon = renderer?.icon;
  const HeaderActions = renderer?.headerActions;
  const expandLabel = isGridPanelHorizontallyExpanded
    ? 'Shrink panel horizontally'
    : 'Expand panel horizontally';
  const ExpandIcon = isGridPanelHorizontallyExpanded
    ? ChevronsRightLeftIcon
    : MoveHorizontalIcon;
  const rendererProps: MosaicDashboardPanelRendererProps | undefined =
    dashboard && panel
      ? {dashboardId, dashboard, panel, selectionName}
      : undefined;

  return (
    <LeafLayout.Header>
      <div
        className="flex items-center justify-between border-b px-2 py-1"
        onClick={handleHeaderClick}
      >
        <LeafLayout.DragHandle className="flex min-w-0 flex-1 items-center gap-1">
          <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={draftTitle}
              className="h-6 min-w-0 flex-1 rounded-sm border border-blue-500 bg-transparent px-1 text-xs font-medium ring-1 ring-blue-500 outline-hidden"
              data-layout-drag-cancel="true"
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={handleCommitTitle}
              onKeyDown={handleTitleKeyDown}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className="min-w-0 truncate text-xs font-medium"
              onDoubleClick={handleTitleDoubleClick}
            >
              {title}
            </span>
          )}
        </LeafLayout.DragHandle>

        {panel && rendererProps ? (
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-0.5">
              {HeaderActions ? <HeaderActions {...rendererProps} /> : null}
              {renderer?.settings ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isSettingsShown ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-6 w-6"
                      aria-label={
                        isSettingsShown
                          ? 'Close panel settings'
                          : 'Open panel settings'
                      }
                      aria-pressed={isSettingsShown}
                      onClick={handleSettingsClick}
                    >
                      <SlidersVerticalIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isSettingsShown
                      ? 'Close panel settings'
                      : 'Open panel settings'}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {canExpandGridPanel ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={expandLabel}
                      onClick={expandGridPanel}
                    >
                      <ExpandIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{expandLabel}</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Remove dashboard panel"
                    onClick={handleRemove}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove dashboard panel</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ) : null}
      </div>
    </LeafLayout.Header>
  );
};
