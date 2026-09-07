import {Button} from '@sqlrooms/ui';
import type {ChartConfig} from '../chart-types/chart-config';
import {FC, useCallback, type ReactNode} from 'react';
import {BlockCaptionEditor} from '../../components/BlockCaptionEditor';
import {SlidersVerticalIcon} from 'lucide-react';
import {useBlockSettingsStore} from '@sqlrooms/documents';

export type ChartBlockHeaderProps = {
  caption?: string;
  chartConfig: ChartConfig;
  onCaptionChange?: (caption: string | undefined) => void;
  onSettingsOpenChange: (open: boolean) => void;
  headerActions?: ReactNode;
  readOnly?: boolean;
  selected?: boolean;
  tableName: string;
};

export const ChartBlockHeader: FC<ChartBlockHeaderProps> = ({
  caption,
  onCaptionChange,
  onSettingsOpenChange,
  headerActions,
  readOnly,
  selected,
  tableName,
}) => {
  const requestOpenSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestOpenSettingsPanel,
  );
  const requestCloseSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestCloseSettingsPanel,
  );
  const isSettingsPanelOpen = useBlockSettingsStore(
    (state) => state.blockSettings.runtime.isSettingsPanelOpen,
  );
  const isSettingsShown = Boolean(selected && isSettingsPanelOpen);

  const handleSettingsClick = useCallback(() => {
    if (isSettingsShown) {
      onSettingsOpenChange(false);
      requestCloseSettingsPanel();
      return;
    }

    onSettingsOpenChange(true);
    requestOpenSettingsPanel();
  }, [
    isSettingsShown,
    onSettingsOpenChange,
    requestCloseSettingsPanel,
    requestOpenSettingsPanel,
  ]);

  return (
    <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
      <BlockCaptionEditor
        value={caption ?? ''}
        placeholder={tableName || 'Chart caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />
      <div className="flex shrink-0 items-center gap-0.5">
        {headerActions ? (
          <div
            className="flex items-center gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            {headerActions}
          </div>
        ) : null}
        <Button
          type="button"
          variant={isSettingsShown ? 'secondary' : 'ghost'}
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={
            isSettingsShown ? 'Close chart settings' : 'Open chart settings'
          }
          aria-pressed={isSettingsShown}
          onClick={handleSettingsClick}
        >
          <SlidersVerticalIcon className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
};
