import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
  PanelTitleFactory,
  DndContextFactory,
  Factory,
} from '@kepler.gl/components';
import React, {PropsWithChildren} from 'react';
import {CustomDndContextFactory} from './CustomDndContext';

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
] as [Factory, Factory][];

export const KeplerInjector = provideRecipesToInjector(recipes, appInjector);
