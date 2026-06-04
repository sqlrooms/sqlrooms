import {LayoutNode} from '@sqlrooms/layout-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {
  LayoutRendererContextType,
  LayoutRendererProvider,
} from './LayoutRendererContext';
import {renderLayoutNode} from './node-renderers/renderLayoutNode';
import {DockingProvider} from './docking/DockingProvider';
import {RenderNodeProvider} from './node-renderers/RenderNodeContext';
import {RoomDndProvider} from './dnd/RoomDndProvider';

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
      <RenderNodeProvider renderNode={renderLayoutNode}>
        <RoomDndProvider>
          <DockingProvider
            rootLayout={contextValue.rootLayout}
            onLayoutChange={contextValue.onLayoutChange}
          >
            <div className={cn('h-full min-h-0 min-w-0 flex-1', className)}>
              {renderLayoutNode({
                node: contextValue.rootLayout,
                path: [],
                containerType: 'root',
              })}
            </div>
          </DockingProvider>
        </RoomDndProvider>
      </RenderNodeProvider>
    </LayoutRendererProvider>
  );
};
