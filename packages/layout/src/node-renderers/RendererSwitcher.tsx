import {LayoutNode} from '@sqlrooms/layout-config';
import {FC, ReactNode} from 'react';
import {LayoutPath} from '../types';
import {useGetPanelInfoByPath} from '../useGetPanel';

export type RendererSwitcherProps = {
  node: LayoutNode;
  path: LayoutPath;
  defaultComponent?: ReactNode;
};

export const RendererSwitcher: FC<RendererSwitcherProps> = ({
  path,
  node,
  defaultComponent,
}) => {
  const panelInfo = useGetPanelInfoByPath(path);

  const CustomRenderer = panelInfo?.panel.component;

  if (CustomRenderer) {
    return <CustomRenderer panelInfo={panelInfo} node={node} path={path} />;
  }

  return defaultComponent;
};
