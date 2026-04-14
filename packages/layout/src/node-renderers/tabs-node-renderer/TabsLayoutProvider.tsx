import {LayoutTabsNode} from '@sqlrooms/layout-config';
import {createContext, FC, PropsWithChildren, useContext} from 'react';
import {LayoutPath} from '../../types';
import {ParentDirection} from '../types';

type TabsLayoutContextValue = {
  node: LayoutTabsNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
};

const TabsLayoutContext = createContext<TabsLayoutContextValue | null>(null);

export const TabsLayoutProvider: FC<
  PropsWithChildren<TabsLayoutContextValue>
> = ({node, path, parentDirection, children}) => {
  const value: TabsLayoutContextValue = {
    node,
    path,
    parentDirection,
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
