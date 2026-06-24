import type {ChartConfig} from '../chart-types/chart-config';
import {FC} from 'react';
import {BlockCaptionEditor} from '../../components/BlockCaptionEditor';

export type ChartBlockHeaderProps = {
  caption?: string;
  chartConfig: ChartConfig;
  onCaptionChange?: (caption: string | undefined) => void;
  onSettingsOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  tableName: string;
};

export const ChartBlockHeader: FC<ChartBlockHeaderProps> = ({
  caption,
  onCaptionChange,
  readOnly,
  tableName,
}) => {
  return (
    <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
      <BlockCaptionEditor
        value={caption ?? ''}
        placeholder={tableName || 'Chart caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />
    </div>
  );
};
