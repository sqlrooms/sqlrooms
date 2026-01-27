import {
  AddDataButtonFactory,
  appInjector,
  DndContextFactory,
  Factory,
  FilterPanelHeaderFactory,
  MapControlTooltipFactory,
  MapLegendFactory,
  MapLegendPanelFactory,
  PanelTitleFactory,
  provideRecipesToInjector,
} from '@kepler.gl/components';
import React, {PropsWithChildren} from 'react';
import {CustomDndContextFactory} from './CustomDndContext';
import {CustomFilterPanelHeaderFactory} from './CustomFilterPanelHeader';
import {CustomMapControlTooltipFactory} from './CustomMapControlTooltipFactory';
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
  [MapControlTooltipFactory, CustomMapControlTooltipFactory],
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
  // Resolve from the injector at render time so late configuration works,
  // while keeping a stable component definition outside render.
  const Wrapped = ((props: Record<string, unknown>) => {
    const Component = getKeplerInjector().get(
      factory as unknown as Factory,
    ) as React.ComponentType<Record<string, unknown>>;
    return <Component {...props} />;
  }) as unknown as ReturnType<TFactory>;
  return Wrapped;
}

export const KeplerInjector = {
  get<TFactory extends KeplerFactory>(factory: TFactory) {
    return getKeplerFactory(factory);
  },
};
