import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {formatTimeRelative} from '@sqlrooms/utils';
import {Edit, MessageSquareReply, Trash2} from 'lucide-react';
import {forwardRef, ReactNode} from 'react';
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
      <TooltipProvider>
        <div ref={ref} className={cn('flex flex-col gap-2', className)}>
          <div className="text-muted-foreground text-xs">
            {renderUser(comment.userId)} -{' '}
            {formatTimeRelative(comment.timestamp)}
            {comment.parentId && ' (reply)'}
          </div>
          {renderComment({comment, renderUser})}
          <div className="mt-1 flex justify-end gap-1 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="xs" onClick={handleReply}>
                  <MessageSquareReply className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reply</p>
              </TooltipContent>
            </Tooltip>
            {comment.userId === userId && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="xs" onClick={handleEdit}>
                      <Edit className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="xs" onClick={handleDelete}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  },
);
CommentItem.displayName = 'CommentItem';
