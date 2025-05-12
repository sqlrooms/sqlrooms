import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
  PanelTitleFactory,
  Factory
} from '@kepler.gl/components';

import React, {PropsWithChildren} from 'react';

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
] as [Factory, Factory][];

export const KeplerInjector = provideRecipesToInjector(recipes, appInjector);
