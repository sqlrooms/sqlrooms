import {LayoutNode} from '@sqlrooms/layout-config';
import {createContext, FC, PropsWithChildren, useContext} from 'react';

export interface LayoutRendererContextType {
  rootLayout: LayoutNode;
  onLayoutChange?: (layout: LayoutNode | null) => void;
  onTabSelect?: (tabsId: string, tabId: string) => void;
  onTabClose?: (tabsId: string, tabId: string) => void;
  onTabReorder?: (tabsId: string, tabIds: string[]) => void;
  onTabCreate?: (tabsId: string) => void;
  onCollapse?: (id: string) => void;
  onExpand?: (id: string, tabId?: string) => void;
}

export const LayoutRendererContext = createContext<
  LayoutRendererContextType | undefined
>(undefined);

export function useLayoutRendererContext(): LayoutRendererContextType {
  const context = useContext(LayoutRendererContext);
  if (context === undefined) {
    throw new Error(
      'useLayoutRendererContext must be used within a LayoutRendererProvider',
    );
  }
  return context;
}

export const LayoutRendererProvider: FC<
  PropsWithChildren<LayoutRendererContextType>
> = ({children, ...contextValue}) => {
  return (
    <LayoutRendererContext.Provider value={contextValue}>
      {children}
    </LayoutRendererContext.Provider>
  );
};
