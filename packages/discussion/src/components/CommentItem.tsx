import {Button, cn} from '@sqlrooms/ui';
import {forwardRef, ReactNode} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {CommentSchema} from '../DiscussionSlice';
import {useStoreWithDiscussion} from '../DiscussionSlice';

// Default implementation for rendering a user
export const defaultRenderUser = (): ReactNode => {
  return 'Anonymous';
};

export type CommentItemProps = {
  discussionId: string;
  comment: CommentSchema;
  isRootComment?: boolean;
  className?: string;
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: CommentSchema;
    renderUser: (userId: string) => ReactNode;
  }) => ReactNode;
};

// Default implementation for rendering a comment's content
const defaultRenderComment = ({
  comment,
}: {
  comment: CommentSchema;
  renderUser: (userId: string) => ReactNode;
}): ReactNode => {
  return <div className="whitespace-pre-wrap text-sm">{comment.text}</div>;
};

export const CommentItem = forwardRef<HTMLDivElement, CommentItemProps>(
  (
    {
      discussionId,
      comment,
      isRootComment = false,
      className,
      renderUser = defaultRenderUser,
      renderComment = defaultRenderComment,
    },
    ref,
  ) => {
    const userId = useStoreWithDiscussion((state) => state.discussion.userId);
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
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {renderUser(comment.userId)} - {formatTimeRelative(comment.timestamp)}
          {comment.parentId && ' (reply)'}
        </div>
        {renderComment({comment, renderUser})}
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
