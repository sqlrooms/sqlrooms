/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  createDefaultKeplerConfig,
  createKeplerSlice,
  useStoreWithKepler,
} from './KeplerSlice';
export type {KeplerSliceState} from './KeplerSlice';

export {FileDropInput} from './components/FileDropInput';
export {KeplerAddDataDialog} from './components/KeplerAddDataDialog';
export type {
  AddDataMethods,
  KeplerAddDataDialogProps,
} from './components/KeplerAddDataDialog';
export {KeplerAddTileSetDialog} from './components/KeplerAddTileSetDialog';
export type {LoadTileSet} from './components/KeplerAddTileSetDialog';
export {KeplerImageExport} from './components/KeplerImageExport';
export {
  configureKeplerInjector,
  KeplerInjector,
  getKeplerFactory,
  getKeplerInjector,
  resetKeplerInjectorRecipes,
} from './components/KeplerInjector';
export type {
  KeplerFactoryRecipe,
  KeplerFactoryRecipeMode,
} from './components/KeplerInjector';
export {KeplerMapContainer} from './components/KeplerMapContainer';
export {KeplerPlotContainer} from './components/KeplerPlotContainer';
export {KeplerProvider} from './components/KeplerProvider';
export {KeplerS3Browser} from './components/KeplerS3Browser';
export type {KeplerS3BrowserProps} from './components/KeplerS3Browser';
export {KeplerSidePanels} from './components/KeplerSidePanels';
export {useKeplerStateActions} from './hooks/useKeplerStateActions';

// Re-export from @sqlrooms/kepler-config
// Values also export their corresponding types automatically (Zod pattern)
export {KeplerMapSchema, KeplerSliceConfig} from '@sqlrooms/kepler-config';

export {CustomDndContextFactory} from './components/CustomDndContext';
export {CustomFilterPanelHeaderFactory} from './components/CustomFilterPanelHeader';
export {CustomMapControlTooltipFactory} from './components/CustomMapControlTooltipFactory';
export {CustomMapLegendFactory} from './components/CustomMapLegend';
export {CustomMapLegendPanelFactory} from './components/CustomMapLegendPanel';
export {
  CustomAddDataButtonFactory,
  CustomPanelTitleFactory,
} from './components/KeplerInjector';
