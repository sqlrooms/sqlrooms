import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {DiscussionSchema} from '../DiscussionSlice';
import {useStoreWithDiscussion} from '../DiscussionSlice';

export type DiscussionItemProps = {
  discussion: DiscussionSchema;
  className?: string;
};

export const DiscussionItem = forwardRef<HTMLDivElement, DiscussionItemProps>(
  ({discussion, className}, ref) => {
    const userId = useStoreWithDiscussion((state) => state.discussion.userId);
    const getUserName = useStoreWithDiscussion(
      (state) => state.discussion.getUserName,
    );
    const setReplyToItem = useStoreWithDiscussion(
      (state) => state.discussion.setReplyToItem,
    );
    const setEditingItem = useStoreWithDiscussion(
      (state) => state.discussion.setEditingItem,
    );
    const setItemToDelete = useStoreWithDiscussion(
      (state) => state.discussion.setItemToDelete,
    );

    const handleReply = () => {
      setReplyToItem({discussionId: discussion.id});
    };

    const handleEdit = () => {
      setEditingItem({discussionId: discussion.id});
    };

    const handleDelete = () => {
      setItemToDelete({discussionId: discussion.id, itemType: 'Discussion'});
    };

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {getUserName(discussion.userId)} -{' '}
          {formatTimeRelative(discussion.timestamp)}
        </div>
        <div className="whitespace-pre-wrap">{discussion.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button variant="ghost" size="xs" onClick={handleReply}>
            Reply
          </Button>
          {discussion.userId === userId && (
            <>
              <Button variant="ghost" size="xs" onClick={handleEdit}>
                Edit
              </Button>
              <Button variant="ghost" size="xs" onClick={handleDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    );
  },
);
DiscussionItem.displayName = 'DiscussionItem';
