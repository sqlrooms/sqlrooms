import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {MosaicNode, MosaicPath, MosaicWindow} from 'react-mosaic-component';
import {MosaicLayoutNode} from '@sqlrooms/layout-config';
import {findParentArea} from './mosaic-utils';

const MosaicTile: FC<{
  id: string;
  path: MosaicPath;
  content: React.ReactNode;
  isDragging: boolean;
  className?: string;
  currentTree?: MosaicNode<string> | null;
}> = (props) => {
  const {id, content, path, isDragging, className, currentTree} = props;
  const body = (
    <div
      className={cn(
        'h-full flex-1 flex-col overflow-hidden p-2',
        className,
        isDragging ? 'pointer-events-none' : '',
      )}
    >
      {content}
    </div>
  );

  const parentArea = currentTree
    ? findParentArea(currentTree as MosaicLayoutNode, path)
    : undefined;
  const isDraggable = parentArea?.node?.draggable === true;

  if (!isDraggable) {
    return body;
  }

  return (
    <MosaicWindow<string> title={id} path={path} draggable={true}>
      {body}
    </MosaicWindow>
  );
};

export default MosaicTile;
