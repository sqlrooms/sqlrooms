import {TabDescriptor} from '@sqlrooms/ui';
import {FC} from 'react';
import {LayoutPath} from '../../types';
import {extractPanelId} from '../utils';
import {useGetPanelByPath} from '../../useGetPanel';

interface TabsLayoutTabLabelProps {
  tab: TabDescriptor;
  path: LayoutPath;
}

export const TabsLayoutTabLabel: FC<TabsLayoutTabLabelProps> = ({
  tab,
  path,
}) => {
  const panelId = extractPanelId(tab.id);

  const panel = useGetPanelByPath(...path, panelId);

  const Icon = panel?.icon;

  return (
    <span className="flex items-center gap-1.5 truncate">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      <span className="truncate">{tab.name}</span>
    </span>
  );
};
