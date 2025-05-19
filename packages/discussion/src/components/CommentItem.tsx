import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {CommentSchema} from '../DiscussionSlice';
import {useStoreWithDiscussion} from '../DiscussionSlice';

export type CommentItemProps = {
  discussionId: string;
  comment: CommentSchema;
  isRootComment?: boolean;
  className?: string;
};

export const CommentItem = forwardRef<HTMLDivElement, CommentItemProps>(
  ({discussionId, comment, isRootComment = false, className}, ref) => {
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
      if (isRootComment) {
        setReplyToItem({discussionId});
      } else {
        setReplyToItem({discussionId, commentId: comment.id});
      }
    };

    const handleEdit = () => {
      if (isRootComment) {
        setEditingItem({discussionId});
      } else {
        setEditingItem({discussionId, commentId: comment.id});
      }
    };

    const handleDelete = () => {
      if (isRootComment) {
        setItemToDelete({discussionId, itemType: 'Discussion'});
      } else {
        setItemToDelete({
          discussionId,
          commentId: comment.id,
          itemType: 'Comment',
        });
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-2',
          isRootComment ? 'mb-4' : '',
          className,
        )}
      >
        <div className="text-muted-foreground text-xs">
          {getUserName(comment.userId)} -{' '}
          {formatTimeRelative(comment.timestamp)}
          {comment.parentId && ' (reply)'}
        </div>
        <div className="whitespace-pre-wrap">{comment.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button variant="ghost" size="xs" onClick={handleReply}>
            Reply
          </Button>
          {comment.userId === userId && (
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
CommentItem.displayName = 'CommentItem';
