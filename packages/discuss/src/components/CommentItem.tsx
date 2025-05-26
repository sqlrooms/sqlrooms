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
import type {Comment, Discussion} from '../DiscussSlice';
import {useStoreWithDiscussion} from '../DiscussSlice';

// Default implementation for rendering a user
export const defaultRenderUser = (): ReactNode => {
  return 'Anonymous';
};

export type CommentItemProps = {
  discussionId: string;
  comment: Comment;
  isRootComment?: boolean;
  className?: string;
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: Comment;
    renderUser: (userId: string) => ReactNode;
    discussion?: Discussion;
  }) => ReactNode;
};

// Default implementation for rendering a comment's content
export const defaultRenderComment = ({
  comment,
  renderUser,
}: {
  comment: Comment;
  renderUser: (userId: string) => ReactNode;
  discussion?: Discussion;
}): ReactNode => {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground text-xs">
        {renderUser(comment.userId)} - {formatTimeRelative(comment.timestamp)}
      </div>
      <div className="whitespace-pre-wrap text-sm">{comment.text}</div>
    </div>
  );
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
    const userId = useStoreWithDiscussion((state) => state.discuss.userId);
    const setReplyToItem = useStoreWithDiscussion(
      (state) => state.discuss.setReplyToItem,
    );
    const setEditingItem = useStoreWithDiscussion(
      (state) => state.discuss.setEditingItem,
    );
    const setItemToDelete = useStoreWithDiscussion(
      (state) => state.discuss.setItemToDelete,
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
