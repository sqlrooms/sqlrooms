import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {MosaicNode, MosaicPath, MosaicWindow} from 'react-mosaic-component';
import {MosaicLayoutNode} from '@sqlrooms/layout-config';
import {isDraggableTile} from './mosaic-utils';
import type {RoomPanelInfo} from '../types';

const MosaicTile: FC<{
  id: string;
  path: MosaicPath;
  content: React.ReactNode;
  isDragging: boolean;
  className?: string;
  currentTree?: MosaicNode<string> | null;
  panelInfo?: RoomPanelInfo;
  forceDraggable?: boolean;
}> = (props) => {
  const {
    id,
    content,
    path,
    isDragging,
    className,
    currentTree,
    panelInfo,
    forceDraggable,
  } = props;
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

  const draggable =
    forceDraggable ||
    (currentTree
      ? isDraggableTile(currentTree as MosaicLayoutNode, path)
      : false);

  if (!draggable) {
    return body;
  }

  const title = panelInfo?.title ?? id;

  return (
    <MosaicWindow<string> title={title} path={path} draggable={true}>
      {body}
    </MosaicWindow>
  );
};

export default MosaicTile;
