import {
  appInjector,
  provideRecipesToInjector,
  AddDataButtonFactory,
} from '@kepler.gl/components';

// hide add data button
function EmptyComponent() {
  return null;
}
const CustomAddDataButtonFactory = () => {
  return EmptyComponent;
};
const recipes = [[AddDataButtonFactory, CustomAddDataButtonFactory]];
export const KeplerInjector = provideRecipesToInjector(recipes, appInjector);
