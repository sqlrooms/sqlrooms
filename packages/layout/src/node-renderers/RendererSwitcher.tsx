import {LayoutNode} from '@sqlrooms/layout-config';
import {FC, PropsWithChildren} from 'react';
import {useLayoutRendererContext} from '../LayoutRendererContext';
import {matchNodePathToPanel} from '../matchNodePathToPanel';
import {LayoutPath} from '../types';

export type RendererSwitcherProps = {
  node: LayoutNode;
  path: LayoutPath;
};

export const RendererSwitcher: FC<PropsWithChildren<RendererSwitcherProps>> = ({
  path,
  node,
  children,
}) => {
  const {panels} = useLayoutRendererContext();
  const panelInfo = matchNodePathToPanel(path, panels);

  const CustomRenderer = panelInfo?.panel.component;

  if (CustomRenderer) {
    return <CustomRenderer panelInfo={panelInfo} node={node} path={path} />;
  }

  return children;
};
