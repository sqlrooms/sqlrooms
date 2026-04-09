import {FC, PropsWithChildren} from 'react';
import {useTabsLayoutContext} from './TabsLayoutProvider';

export const TabsLayoutTabContentContainer: FC<PropsWithChildren> = ({
  children,
}) => {
  const {node} = useTabsLayoutContext();
  const activeChild = node.children[node.activeTabIndex];

  if (!activeChild || node.collapsed) {
    return null;
  }

  return <div className="min-h-0 flex-1">{children}</div>;
};
