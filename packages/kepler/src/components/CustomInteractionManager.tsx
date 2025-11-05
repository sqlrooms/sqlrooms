import React, {useCallback} from 'react';
import styled from 'styled-components';
import {Switch, Checkbox, useTheme} from '@sqlrooms/ui';

import {TooltipConfigFactory} from '@kepler.gl/components';
import {InteractionConfig} from '@kepler.gl/types';
import {FormattedMessage} from '@kepler.gl/localization';

import {
  useKeplerStateActions,
} from '../hooks/useKeplerStateActions';
import {KeplerInjector} from './KeplerInjector';

const TooltipConfigWrapper = styled.div<{isDark: boolean}>`
  .sortable-layer-items > div {
    padding: 2px 4px;
    background-color: ${props => props.theme.sidePanelBg || props.theme.panelBackground};
    border-radius: 4px;
  }
  .chickleted-input {
    background-color: ${props => props.isDark ? '#0f172a' : '#F6F8FB'} !important;
    border-color: transparent;
    border-radius: 6px;
    font-weight: 400;
  }
  .side-panel-section {
    position: relative;
  }
  .side-panel-section > :first-child {
    display:flex;
    justify-content: space-between;
    position: absolute;
    width: 100%;
    padding: 0px 9px;
    top: 8px;
  }
  .field-selector {
    padding-top: 32px;
    background-color: ${props => props.isDark ? '#0f172a' : '#F6F8FB'} !important;
  }
  .update-color {
    display: none;
  }
  .dataset-name {
    font-weight: 500;
    font-size: 12px;
  }
  .clear-all {
    width: 64px;
    font-weight: 400;
    color: #94A2B8 !important;
    font-size: 12px;
  }
`;

const TooltipConfig = KeplerInjector.get(TooltipConfigFactory);

const SimpleInteractionPanel: React.FC<{
  configId: string;
  config: any;
  label: string;
  handleConfigChange: (configId: string, newConfig: any) => void;
}> = ({configId, config, label, handleConfigChange}) => {
  const toggleEnableConfig = useCallback(() => {
    handleConfigChange(configId, {
      enabled: !config.enabled,
    });
  }, [configId, config.enabled]);

  return (
    <div className="p-2 flex items-center justify-between">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
      <Switch
        checked={config.enabled}
        onCheckedChange={toggleEnableConfig}
        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary"
      />
    </div>
  );
};

const TooltipPanel: React.FC<{
  tooltipConfig: any;
  coordinateConfig: any;
  datasets: any;
  isDark: boolean;
  handleConfigChange: (configId: string, newConfig: any) => void;
  handleCoordinateToggle: () => void;
  setColumnDisplayFormat: (format: any) => void;
}> = ({
  tooltipConfig,
  coordinateConfig,
  datasets,
  isDark,
  handleConfigChange,
  handleCoordinateToggle,
  setColumnDisplayFormat,
}) => {
  if (!tooltipConfig) return null;

  const handleTooltipConfigChange = useCallback((newConfig: any) => {
    handleConfigChange('tooltip', { config: newConfig });
  }, [handleConfigChange]);

  return (
    <div>
      <SimpleInteractionPanel
        configId="tooltip"
        config={tooltipConfig}
        label="Tooltip"
        handleConfigChange={handleConfigChange}
      />
      {tooltipConfig.enabled && (
        <div className="pr-2 pl-4">
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              checked={coordinateConfig?.enabled || false}
              onCheckedChange={handleCoordinateToggle}
              className='shadow-none'
            />
            <span className="text-xs text-muted-foreground">
              Show <FormattedMessage id="interactions.coordinate" />
            </span>
          </div>
          <TooltipConfigWrapper isDark={isDark}>
            <TooltipConfig
              datasets={datasets}
              config={tooltipConfig.config}
              onChange={handleTooltipConfigChange}
              onDisplayFormatChange={setColumnDisplayFormat}
            />
          </TooltipConfigWrapper>
        </div>
      )}
    </div>
  );
};

export const CustomInteractionManager: React.FC<{mapId: string}> = ({
  mapId,
}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const {theme} = useTheme();

  // Determine if dark mode is active
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const interactionConfig: Partial<InteractionConfig> = keplerState?.visState.interactionConfig || {};
  const datasets = keplerState?.visState.datasets || {};
  const {interactionConfigChange, setColumnDisplayFormat} = keplerActions.visStateActions;

  const handleConfigChange = useCallback((configId: string, newConfig: any) => {
    const currentConfig = interactionConfig[configId as keyof InteractionConfig];
    if (currentConfig && typeof currentConfig === 'object') {
      interactionConfigChange({
        ...currentConfig,
        ...newConfig,
      });
    }
  }, [interactionConfig, interactionConfigChange]);

  // Handle coordinate display toggle
  const handleCoordinateToggle = useCallback(() => {
    const coordinateConfig = interactionConfig.coordinate;
    if (coordinateConfig && typeof coordinateConfig === 'object') {
      interactionConfigChange({
        ...coordinateConfig,
        enabled: !coordinateConfig.enabled,
      });
    }
  }, [interactionConfig.coordinate, interactionConfigChange]);



  return (
    <div className="interaction-manager">
      <div className="space-y-2">
        <TooltipPanel
          tooltipConfig={interactionConfig.tooltip}
          coordinateConfig={interactionConfig.coordinate}
          datasets={datasets}
          isDark={isDark}
          handleConfigChange={handleConfigChange}
          handleCoordinateToggle={handleCoordinateToggle}
          setColumnDisplayFormat={setColumnDisplayFormat}
        />
        {interactionConfig.geocoder && (
          <SimpleInteractionPanel
            configId="geocoder"
            config={interactionConfig.geocoder}
            label="Location search"
            handleConfigChange={handleConfigChange}
          />
        )}
        {interactionConfig.brush && (
          <SimpleInteractionPanel
            configId="brush"
            config={interactionConfig.brush}
            label="Brush filter"
            handleConfigChange={handleConfigChange}
          />
        )}
      </div>
    </div>
  );
};