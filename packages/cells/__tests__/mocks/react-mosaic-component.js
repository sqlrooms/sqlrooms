export const Mosaic = () => null;
export const MosaicWithoutDragDropContext = () => null;
export const MosaicWindow = () => null;
export const MosaicTabs = () => null;
export const MosaicZeroState = () => null;
export const MosaicContext = {};
export const MosaicWindowContext = {};
export const MosaicDragType = {};
export const createBalancedTreeFromLeaves = () => null;
export const getLeaves = () => [];
export const updateTree = (tree) => tree;
export const createRemoveUpdate = () => ({});
export const createExpandUpdate = () => ({});
export const createHideUpdate = () => ({});
export const createDragToUpdates = () => [];
export const convertLegacyToNary = (node) => node;
export const isSplitNode = (node) =>
  node != null && typeof node === 'object' && node.type === 'split';
export const isTabsNode = (node) =>
  node != null && typeof node === 'object' && node.type === 'tabs';
export const getParentNode = () => null;
export const getParentPath = () => [];
export const getNodeAtPath = () => null;
export const getAndAssertNodeAtPathExists = () => null;
export const getOtherDirection = (d) => (d === 'row' ? 'column' : 'row');
export const getPathToCorner = () => [];
export const Corner = {
  TOP_LEFT: 1,
  TOP_RIGHT: 2,
  BOTTOM_LEFT: 3,
  BOTTOM_RIGHT: 4,
};
export default {};
