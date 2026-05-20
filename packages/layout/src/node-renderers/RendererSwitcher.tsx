import {FC, ReactNode} from 'react';
import {useGetPanel} from '../useGetPanel';
import {useLayoutNodeContext} from '../LayoutNodeContext';
import {resolvePanelIdentity} from '../resolvePanelIdentity';

export type RendererSwitcherProps = {
  defaultComponent?: ReactNode;
};

export const RendererSwitcher: FC<RendererSwitcherProps> = ({
  defaultComponent,
}) => {
  const context = useLayoutNodeContext();
  const panelInfo = useGetPanel(context.node);

  const CustomRenderer = panelInfo?.component;

  if (CustomRenderer) {
    const panelIdentity = resolvePanelIdentity(context.node);

    if (!panelIdentity.panelId) {
      return defaultComponent;
    }

    return <CustomRenderer panelInfo={panelInfo} {...panelIdentity} />;
  }

  return defaultComponent;
};
