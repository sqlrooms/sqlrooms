import {LayoutNode} from '@sqlrooms/layout-config';
import {FC, ReactNode} from 'react';
import {useLayoutRendererContext} from '../LayoutRendererContext';
import {matchNodePathToPanel} from '../matchNodePathToPanel';
import {LayoutPath} from '../types';

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
  const {panels} = useLayoutRendererContext();
  const panelInfo = matchNodePathToPanel(path, panels);

  const CustomRenderer = panelInfo?.panel.component;

  if (CustomRenderer) {
    return <CustomRenderer panelInfo={panelInfo} node={node} path={path} />;
  }

  return defaultComponent;
};
