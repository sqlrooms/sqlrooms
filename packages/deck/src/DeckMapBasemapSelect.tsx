import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTheme,
} from '@sqlrooms/ui';
import type {FC} from 'react';
import type {DeckMapConfig} from './mapConfig';
import {
  DECK_MAP_BASEMAP_STYLES,
  getDeckMapStyleTheme,
  getDefaultDeckMapStyle,
} from './mapStyles';
import {DeckMapSettingsField} from './MapSettingsControls';

/** Selects a persistent basemap independently of the app's current theme. */
export const DeckMapBasemapSelect: FC<{
  config: DeckMapConfig;
  onConfigChange: (config: DeckMapConfig) => void;
  readOnly?: boolean;
}> = ({config, onConfigChange, readOnly}) => {
  const {resolvedTheme} = useTheme();
  const style = config.mapStyle ?? config.mapProps?.mapStyle;
  const styleTheme = getDeckMapStyleTheme(style);
  const value = style
    ? styleTheme
      ? getDefaultDeckMapStyle(styleTheme)
      : 'custom'
    : getDefaultDeckMapStyle(resolvedTheme);

  return (
    <DeckMapSettingsField label="Basemap">
      <Select
        value={value}
        disabled={readOnly}
        onValueChange={(mapStyle) => {
          if (!readOnly) onConfigChange({...config, mapStyle});
        }}
      >
        <SelectTrigger aria-label="Basemap" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DECK_MAP_BASEMAP_STYLES.map(({id, label}) => (
            <SelectItem key={id} value={id}>
              {label}
            </SelectItem>
          ))}
          {value === 'custom' && (
            <SelectItem value="custom" disabled>
              Custom
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </DeckMapSettingsField>
  );
};
