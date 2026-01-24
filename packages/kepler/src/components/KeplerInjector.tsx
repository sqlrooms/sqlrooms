import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
  PanelTitleFactory,
  DndContextFactory,
  Factory,
  FilterPanelHeaderFactory,
  MapLegendFactory,
  MapLegendPanelFactory,
} from '@kepler.gl/components';
import React, {PropsWithChildren} from 'react';
import {CustomDndContextFactory} from './CustomDndContext';
import {CustomFilterPanelHeaderFactory} from './CustomFilterPanelHeader';
import {CustomMapLegendFactory} from './CustomMapLegend';
import {CustomMapLegendPanelFactory} from './CustomMapLegendPanel';

const CustomAddDataButtonFactory = () => {
  return () => null;
};

const CustomPanelTitleFactory = () => {
  const PanelTitle: React.FC<PropsWithChildren> = ({children}) => (
    <div className="flex items-center justify-end">{children}</div>
  );

  return PanelTitle;
};
export type KeplerFactory<TReturn = unknown> = (...args: any[]) => TReturn;
export type KeplerFactoryRecipe = [KeplerFactory, KeplerFactory];
export type KeplerFactoryRecipeMode = 'append' | 'replace';

const defaultRecipes: KeplerFactoryRecipe[] = [
  [AddDataButtonFactory, CustomAddDataButtonFactory],
  [PanelTitleFactory, CustomPanelTitleFactory],
  [DndContextFactory, CustomDndContextFactory],
  [FilterPanelHeaderFactory, CustomFilterPanelHeaderFactory],
  [MapLegendPanelFactory, CustomMapLegendPanelFactory],
  [MapLegendFactory, CustomMapLegendFactory],
];

let customRecipes: KeplerFactoryRecipe[] = [];
let injector = createKeplerInjector();

function createKeplerInjector(recipes: KeplerFactoryRecipe[] = []) {
  return provideRecipesToInjector(
    [...defaultRecipes, ...recipes] as unknown as [Factory, Factory][],
    appInjector,
  );
}

export function configureKeplerInjector(
  recipes: KeplerFactoryRecipe[],
  options: {mode?: KeplerFactoryRecipeMode} = {},
) {
  const mode = options.mode ?? 'append';
  customRecipes =
    mode === 'replace' ? [...recipes] : [...customRecipes, ...recipes];
  injector = createKeplerInjector(customRecipes);
}

export function resetKeplerInjectorRecipes() {
  customRecipes = [];
  injector = createKeplerInjector();
}

export function getKeplerInjector() {
  return injector;
}

export function getKeplerFactory<TFactory extends KeplerFactory>(
  factory: TFactory,
): ReturnType<TFactory> {
  return getKeplerInjector().get(factory as unknown as Factory);
}

export const KeplerInjector = {
  get<TFactory extends KeplerFactory>(factory: TFactory) {
    return getKeplerInjector().get(factory as unknown as Factory);
  },
};
