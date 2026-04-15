import {FC, PropsWithChildren} from 'react';
import {useTabsNodeContext} from '../../LayoutNodeContext';

export const TabsLayoutTabContentContainer: FC<PropsWithChildren> = ({
  children,
}) => {
  const {node} = useTabsNodeContext();
  const activeChild = node.children[node.activeTabIndex];

  if (!activeChild || node.collapsed) {
    return null;
  }

  return <div className="min-h-0 flex-1">{children}</div>;
};
