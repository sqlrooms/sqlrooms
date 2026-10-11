import {createContext, FC, ReactElement, ReactNode, useContext} from 'react';
import type {NodeRenderProps} from './types';

type RenderNodeFn = (props: NodeRenderProps) => ReactElement;

const RenderNodeContext = createContext<RenderNodeFn | null>(null);

export const RenderNodeProvider: FC<{
  children: ReactNode;
  renderNode: RenderNodeFn;
}> = ({children, renderNode}) => {
  return (
    <RenderNodeContext.Provider value={renderNode}>
      {children}
    </RenderNodeContext.Provider>
  );
};

export const useRenderNode = (): RenderNodeFn => {
  const renderNode = useContext(RenderNodeContext);
  if (!renderNode) {
    throw new Error('useRenderNode must be used within a RenderNodeProvider');
  }
  return renderNode;
};
