import {
  AddDataButtonFactory,
  ContainerFactory,
  injector as createInjector,
  DndContextFactory,
  Factory,
  FilterPanelHeaderFactory,
  flattenDeps,
  MapControlTooltipFactory,
  MapLegendFactory,
  MapLegendPanelFactory,
  PanelTitleFactory,
  typeCheckRecipe,
  type InjectorType,
} from '@kepler.gl/components';
import React, {PropsWithChildren} from 'react';
import {CustomDndContextFactory} from './CustomDndContext';
import {CustomFilterPanelHeaderFactory} from './CustomFilterPanelHeader';
import {CustomMapControlTooltipFactory} from './CustomMapControlTooltipFactory';
import {CustomMapLegendFactory} from './CustomMapLegend';
import {CustomMapLegendPanelFactory} from './CustomMapLegendPanel';

export const CustomAddDataButtonFactory = () => {
  return () => null;
};

export const CustomPanelTitleFactory = () => {
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

function createBaseInjector() {
  const allDependencies = flattenDeps(
    [],
    ContainerFactory as unknown as Factory,
  );
  return allDependencies.reduce(
    (current, factory) => current.provide(factory, factory),
    createInjector(),
  );
}

function provideRecipesToInjectorSafely(
  recipes: KeplerFactoryRecipe[],
  baseInjector: InjectorType,
) {
  const replacementTargets = new Set(
    recipes
      .filter((recipe) =>
        typeCheckRecipe(recipe as unknown as [Factory, Factory]),
      )
      .map((recipe) => recipe[0]),
  );

  const provided = new Map();

  const injectorWithRecipes = recipes.reduce((currentInjector, recipe) => {
    if (!typeCheckRecipe(recipe as unknown as [Factory, Factory])) {
      return currentInjector;
    }

    const [factoryToReplace, replacementFactory] = recipe;
    const customDependencies = flattenDeps(
      [],
      replacementFactory as unknown as Factory,
    );

    const injectorWithDependencies = customDependencies.reduce(
      (dependencyInjector, dependencyFactory) => {
        // If a dependency has an explicit replacement recipe, skip self-injecting it.
        // This avoids overriding previous replacements and warning noise.
        if (
          replacementTargets.has(dependencyFactory as unknown as KeplerFactory)
        ) {
          return dependencyInjector;
        }
        return dependencyInjector.provide(dependencyFactory, dependencyFactory);
      },
      currentInjector,
    );

    provided.set(factoryToReplace, replacementFactory);
    return injectorWithDependencies.provide(
      factoryToReplace,
      replacementFactory,
    );
  }, baseInjector);

  provided.forEach((replacementFactory) => {
    injectorWithRecipes.get(replacementFactory);
  });

  return injectorWithRecipes;
}

function createKeplerInjector(recipes: KeplerFactoryRecipe[] = []) {
  return provideRecipesToInjectorSafely(
    [...defaultRecipes, ...recipes],
    createBaseInjector(),
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
