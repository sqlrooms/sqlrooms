import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
  LayerGroupSelectorFactory,
  PanelTitleFactory,
  SidePanelSection,
  Button,
  Icons,
} from '@kepler.gl/components';
import {
  SIDEBAR_PANELS,
  ADD_MAP_STYLE_ID,
} from '@kepler.gl/constants';
import {MapStyle} from '@kepler.gl/reducers';

import {KeplerInjector} from './KeplerInjector';
import {KeplerActions, useKeplerStateActions} from '../hooks/useKeplerStateActions';

import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@sqlrooms/ui';
import { ChevronDown } from 'lucide-react';

// Get the kepler.gl components through the injector
const LayerGroupSelector = KeplerInjector.get(LayerGroupSelectorFactory);
const PanelTitle = KeplerInjector.get(PanelTitleFactory);

// Import icons from kepler.gl
const { Add, Trash } = Icons;

const mapPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'map');

// Custom styled components for the map manager
const CustomMapManagerContainer = styled.div<{ isOpen?: boolean }>`
  .map-style-panel {
    /* Add your custom styles here */
  }
  
  .map-manager-title {
    /* Custom title styling */
  }

  .add-map-style-button {
    background-color: ${props => props.theme.sidePanelBg || props.theme.panelBackground || '#fff'};
    color: ${props => props.theme.activeColor || props.theme.textColorHl || '#2563EB'};
    border: 0px;
    height: 28px;
    font-weight: 500;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .layer-group__header {
    display: none;
  }
`;

type CustomMapManagerProps = {
  mapId: string;
};

// Custom hook for map style actions
function useCustomMapActions(keplerActions: KeplerActions) {
  const {toggleModal} = keplerActions.uiStateActions;
  const {mapStyleChange, removeCustomMapStyle} = keplerActions.mapStyleActions;

  const onShowAddMapStyleModal = useCallback(
    () => toggleModal(ADD_MAP_STYLE_ID),
    [toggleModal],
  );

  const onMapStyleChange = useCallback(
    (styleType: string) => mapStyleChange(styleType),
    [mapStyleChange],
  );

  const onRemoveCustomMapStyle = useCallback(
    (styleId: string) => removeCustomMapStyle({id: styleId}),
    [removeCustomMapStyle],
  );

  return {
    onShowAddMapStyleModal,
    onMapStyleChange,
    onRemoveCustomMapStyle,
  };
}

// Custom Map Style Dropdown Component
const MapStyleDropdown: React.FC<{
  mapStyle: MapStyle;
  onChange: (styleType: string) => void;
  customMapStylesActions?: any;
}> = ({ mapStyle, onChange, customMapStylesActions }) => {
  const { mapStyles, styleType } = mapStyle;
  const currentStyle = mapStyles[styleType];

  const handleStyleSelect = (styleId: string) => 
    onChange(styleId);
;

  return (
    <div className='w-full'>
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="w-full">
        <div className="flex w-full items-center justify-between min-h-[40px] px-3 py-2 cursor-pointer border rounded transition-colors border-primary-foreground bg-muted hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white">
          <div className="flex items-center gap-2">
            <img 
              className="w-6 h-6 rounded-sm object-cover" 
              src={currentStyle?.icon || ''} 
              alt={currentStyle?.label || 'Map Style'}
            />
            <span className="text-sm font-medium dark:text-white">{currentStyle?.label || 'Select Style'}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto bg-white dark:bg-gray-700">
        {Object.values(mapStyles).map((style: any) => (
          <DropdownMenuCheckboxItem
            key={style.id}
            onClick={() => handleStyleSelect(style.id)}
            className="flex items-center gap-2 p-2 cursor-pointer bg-white dark:hover:bg-gray-600 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <img 
              src={style.icon || ''} 
              alt={style.label || 'Untitled'}
              className="w-6 h-6 rounded-sm object-cover flex-shrink-0"
            />
            <span className="flex-1 text-sm truncate">{style.label || 'Untitled'}</span>
            {style.custom && customMapStylesActions?.[style.id] && (
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                {customMapStylesActions[style.id].map((action: any) => (
                  <button
                    key={action.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    className="p-1 rounded transition-colors bg-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={action.tooltip}
                  >
                    <action.IconComponent height="16px" />
                  </button>
                ))}
              </div>
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );

};

// Main Custom Map Manager Component
export const CustomMapManager: React.FC<CustomMapManagerProps> = ({
  mapId,
}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const intl = useIntl();

  const {onShowAddMapStyleModal, onMapStyleChange, onRemoveCustomMapStyle} = useCustomMapActions(keplerActions);

  if (!keplerState || !keplerActions) {
    return null;
  }

  const { mapStyle } = keplerState;
  const currentStyle = mapStyle.mapStyles[mapStyle.styleType] || {};
  const editableLayers = (currentStyle as any).layerGroups || [];

  // Custom map styles actions (for delete functionality)
  const customMapStylesActions = useMemo(() => {
    const actionsPerCustomStyle: any = {};
    Object.values(mapStyle.mapStyles)
      .filter((style: any) => Boolean(style.custom))
      .forEach((style: any) => {
        actionsPerCustomStyle[style.id] = [
          {
            id: `remove-map-style-${style.id}`,
            IconComponent: Trash,
            tooltip: 'tooltip.removeBaseMapStyle',
            onClick: () => onRemoveCustomMapStyle(style.id)
          }
        ];
      });
    return actionsPerCustomStyle;
  }, [mapStyle.mapStyles, onRemoveCustomMapStyle]);

  return (
    <CustomMapManagerContainer>
      <div className="map-style-panel">
        <SidePanelSection>
          <PanelTitle
            className="map-manager-title"
            title={intl.formatMessage({id: mapPanelMetadata?.label || 'Base map'})}
          >
            <Button className="add-map-style-button" onClick={onShowAddMapStyleModal}>
              <Add height="12px" />
              <span>{intl.formatMessage({id: 'mapManager.addMapStyle'})}</span>
            </Button>
          </PanelTitle>
        </SidePanelSection>

        <SidePanelSection>
          <div className="mb-1">
            <MapStyleDropdown
              mapStyle={mapStyle}
              onChange={onMapStyleChange}
              customMapStylesActions={customMapStylesActions}
            />
          </div>

          {editableLayers.length ? (
            <LayerGroupSelector
              layers={mapStyle.visibleLayerGroups}
              editableLayers={editableLayers}
              topLayers={mapStyle.topLayerGroups}
              onChange={keplerActions.mapStyleActions.mapConfigChange}
              threeDBuildingColor={mapStyle.threeDBuildingColor}
              on3dBuildingColorChange={keplerActions.mapStyleActions.set3dBuildingColor}
              backgroundColor={mapStyle.backgroundColor}
              onBackgroundColorChange={keplerActions.mapStyleActions.setBackgroundColor}
            />
          ) : null}
        </SidePanelSection>
      </div>
    </CustomMapManagerContainer>
  );
};

export default CustomMapManager;