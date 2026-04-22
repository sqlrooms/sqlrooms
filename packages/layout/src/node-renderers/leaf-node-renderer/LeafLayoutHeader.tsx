import {FC} from 'react';
import {GripVerticalIcon, XIcon} from 'lucide-react';
import {useIsDockablePanel} from './useIsDockable';
import {useRemovePanelHandler} from './useRemovePanel';
import {LeafLayoutDragHandle} from './LeafLayoutDragHandle';
import {Button} from '@sqlrooms/ui';
import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {useGetPanel} from '../../useGetPanel';
import {useLayoutNodeContext} from '../../LayoutNodeContext';

export const LeafLayoutHeader: FC = () => {
  const isDockable = useIsDockablePanel();
  const handleRemove = useRemovePanelHandler();

  const {node} = useLayoutNodeContext();
  const panelId = getLayoutNodeId(node);
  const panelInfo = useGetPanel(node);

  const title = panelInfo?.title ?? panelId;

  if (!isDockable) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex h-8 w-full border-b">
      <div className="flex h-full min-w-0 flex-1 gap-1">
        <LeafLayoutDragHandle className="flex min-w-0 flex-1 items-center gap-1">
          <GripVerticalIcon className="mx-1 h-4 w-4 shrink-0" />
          <span className="truncate">{title}</span>
        </LeafLayoutDragHandle>
      </div>
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="hover:text-foreground h-8 w-8 transition-colors"
          aria-label={`Close ${title}`}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
