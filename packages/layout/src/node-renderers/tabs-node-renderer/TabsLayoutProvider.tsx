import {LayoutTabsNode} from '@sqlrooms/layout-config';
import {createContext, FC, PropsWithChildren, useContext} from 'react';
import {LayoutPath} from '../../types';
import {TabsLayoutInfo, useTabsLayoutInfo} from './useTabsLayoutInfo';
import {ParentDirection} from '../types';

type TabsLayoutContextValue = {
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
} & TabsLayoutInfo;

const TabsLayoutContext = createContext<TabsLayoutContextValue | null>(null);

interface TabsLayoutProviderProps {
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
}

export const TabsLayoutProvider: FC<
  PropsWithChildren<TabsLayoutProviderProps>
> = ({node, path, parentDirection, children}) => {
  const info = useTabsLayoutInfo(node, path);

  const value: TabsLayoutContextValue = {
    node,
    path,
    parentDirection,
    ...info,
  };

  return (
    <TabsLayoutContext.Provider value={value}>
      {children}
    </TabsLayoutContext.Provider>
  );
};

export function useTabsLayoutContext(): TabsLayoutContextValue {
  const context = useContext(TabsLayoutContext);
  if (!context) {
    throw new Error(
      'useTabsLayoutContext must be used within TabsLayoutProvider',
    );
  }
  return context;
}
