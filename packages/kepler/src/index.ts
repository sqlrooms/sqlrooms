/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  createKeplerSlice,
  useStoreWithKepler,
  createDefaultKeplerConfig,
} from './KeplerSlice';
export type {KeplerSliceState} from './KeplerSlice';

export {KeplerMapContainer} from './components/KeplerMapContainer';
export {KeplerSidePanels} from './components/KeplerSidePanels';
export {KeplerAddTileSetDialog} from './components/KeplerAddTileSetDialog';
export type {LoadTileSet} from './components/KeplerAddTileSetDialog';
export {KeplerAddDataDialog} from './components/KeplerAddDataDialog';
export type {
  KeplerAddDataDialogProps,
  AddDataMethods,
} from './components/KeplerAddDataDialog';
export {FileDropInput} from './components/FileDropInput';
export {KeplerS3Browser} from './components/KeplerS3Browser';
export type {KeplerS3BrowserProps} from './components/KeplerS3Browser';
export {KeplerProvider} from './components/KeplerProvider';
export {useKeplerStateActions} from './hooks/useKeplerStateActions';
export {KeplerPlotContainer} from './components/KeplerPlotContainer';
export {KeplerImageExport} from './components/KeplerImageExport';
export {
  configureKeplerInjector,
  resetKeplerInjectorRecipes,
  getKeplerInjector,
  getKeplerFactory,
} from './components/KeplerInjector';
export type {
  KeplerFactoryRecipe,
  KeplerFactoryRecipeMode,
} from './components/KeplerInjector';

// Re-export from @sqlrooms/kepler-config
// Values also export their corresponding types automatically (Zod pattern)
export {KeplerMapSchema, KeplerSliceConfig} from '@sqlrooms/kepler-config';
