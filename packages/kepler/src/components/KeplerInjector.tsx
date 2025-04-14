import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
  PanelTitleFactory,
} from '@kepler.gl/components';
import {PropsWithChildren} from 'react';

// hide add data button
function EmptyComponent() {
  return null;
}

const CustomAddDataButtonFactory = () => {
  return EmptyComponent;
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
];
export const KeplerInjector = provideRecipesToInjector(recipes, appInjector);
