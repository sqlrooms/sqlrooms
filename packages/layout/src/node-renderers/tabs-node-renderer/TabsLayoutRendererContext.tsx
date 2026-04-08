import {LayoutTabsNode} from '@sqlrooms/layout-config';
import {TabDescriptor} from '@sqlrooms/ui';
import {createContext, FC, PropsWithChildren, useContext} from 'react';
import {LayoutPath} from '../../types';
import {useLayoutTabsNodeTabsInfo} from './useLayoutTabsNodeTabsInfo';
import {ParentDirection} from '../types';

interface TabsLayoutRendererContextValue {
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
  activeTabId?: string;
  visibleTabIds: string[];
  allTabIds: string[];
  tabDescriptors: TabDescriptor[];
}

const TabsLayoutRendererContext =
  createContext<TabsLayoutRendererContextValue | null>(null);

interface TabsLayoutRendererProviderProps {
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
}

export const TabsLayoutRendererProvider: FC<
  PropsWithChildren<TabsLayoutRendererProviderProps>
> = ({node, path, parentDirection, children}) => {
  const {activeTabId, visibleTabIds, allTabIds, tabDescriptors} =
    useLayoutTabsNodeTabsInfo(node, path);

  const value: TabsLayoutRendererContextValue = {
    node,
    path,
    parentDirection,
    activeTabId,
    visibleTabIds,
    allTabIds,
    tabDescriptors,
  };

  return (
    <TabsLayoutRendererContext.Provider value={value}>
      {children}
    </TabsLayoutRendererContext.Provider>
  );
};

export function useTabsLayoutRendererContext(): TabsLayoutRendererContextValue {
  const context = useContext(TabsLayoutRendererContext);
  if (!context) {
    throw new Error(
      'useTabsLayoutRendererContext must be used within TabsLayoutRendererProvider',
    );
  }
  return context;
}
