import {LayoutNode} from '@sqlrooms/layout-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {
  LayoutRendererContextType,
  LayoutRendererProvider,
} from './LayoutRendererContext';
import {DockingProvider} from './docking/DockingContext';
import {LayoutNodeRenderer} from './node-renderers/LayoutNodeRenderer';

export type LayoutRendererProps = {
  rootLayout: LayoutNode;
  className?: string;
} & LayoutRendererContextType;

export const LayoutRenderer: FC<LayoutRendererProps> = ({
  className,
  ...contextValue
}) => {
  return (
    <LayoutRendererProvider {...contextValue}>
      <DockingProvider
        rootLayout={contextValue.rootLayout}
        onLayoutChange={contextValue.onLayoutChange}
      >
        <div className={cn('h-full min-w-0 flex-1', className)}>
          <LayoutNodeRenderer
            node={contextValue.rootLayout}
            path={[]}
            containerType="root"
          />
        </div>
      </DockingProvider>
    </LayoutRendererProvider>
  );
};
