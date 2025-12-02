import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
  PanelTitleFactory,
  DndContextFactory,
  Factory,
  FilterPanelHeaderFactory,
} from '@kepler.gl/components';
import React, {PropsWithChildren} from 'react';
import {CustomDndContextFactory} from './CustomDndContext';
import {CustomFilterPanelHeaderFactory} from './CustomFilterPanelHeader';

const CustomAddDataButtonFactory = () => {
  return () => null;
};

const CustomPanelTitleFactory = () => {
  const PanelTitle: React.FC<PropsWithChildren> = ({children}) => (
    <div className="flex items-center justify-end">{children}</div>
  );

  return PanelTitle;
};
const recipes = [
  [AddDataButtonFactory, CustomAddDataButtonFactory],
  [PanelTitleFactory, CustomPanelTitleFactory],
  [DndContextFactory, CustomDndContextFactory],
  [FilterPanelHeaderFactory, CustomFilterPanelHeaderFactory],
] as [Factory, Factory][];

export const KeplerInjector = provideRecipesToInjector(recipes, appInjector);
