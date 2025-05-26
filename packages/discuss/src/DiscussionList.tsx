import {cn} from '@sqlrooms/ui';
import {
  ComponentPropsWithoutRef,
  forwardRef,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import {defaultRenderUser} from './components/CommentItem';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';
import {DiscussionItem} from './components/DiscussionItem';
import {EditCommentForm} from './components/EditCommentForm';
import type {Comment, Discussion} from './DiscussSlice';
import {useStoreWithDiscussion} from './DiscussSlice';

// Main DiscussionList component
type DiscussionListProps = ComponentPropsWithoutRef<'div'> & {
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: Comment;
    renderUser: (userId: string) => ReactNode;
    discussion?: Discussion;
  }) => ReactNode;
  highlightedDiscussionId?: string;
};

export const DiscussionList = forwardRef<HTMLDivElement, DiscussionListProps>(
  (
    {
      className,
      renderUser = defaultRenderUser,
      renderComment,
      highlightedDiscussionId,
      ...props
    },
    ref,
  ) => {
    const discussions = useStoreWithDiscussion(
      (state) => state.config.discuss.discussions,
    );
    const replyToItem = useStoreWithDiscussion(
      (state) => state.discuss.replyToItem,
    );
    const editingItem = useStoreWithDiscussion(
      (state) => state.discuss.editingItem,
    );
    const itemToDelete = useStoreWithDiscussion(
      (state) => state.discuss.itemToDelete,
    );
    const setReplyToItem = useStoreWithDiscussion(
      (state) => state.discuss.setReplyToItem,
    );
    const setEditingItem = useStoreWithDiscussion(
      (state) => state.discuss.setEditingItem,
    );
    const setItemToDelete = useStoreWithDiscussion(
      (state) => state.discuss.setItemToDelete,
    );
    const submitEdit = useStoreWithDiscussion(
      (state) => state.discuss.submitEdit,
    );
    const handleDeleteConfirm = useStoreWithDiscussion(
      (state) => state.discuss.handleDeleteConfirm,
    );
    const getReplyToUserId = useStoreWithDiscussion(
      (state) => state.discuss.getReplyToUserId,
    );
    const getEditingItemText = useStoreWithDiscussion(
      (state) => state.discuss.getEditingItemText,
    );

    // Reference to highlighted discussion
    const highlightedRef = useRef<HTMLDivElement>(null);

    // Scroll to highlighted discussion
    useEffect(() => {
      if (highlightedDiscussionId && highlightedRef.current) {
        highlightedRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, [highlightedDiscussionId]);

    // Get the rendered representation of the user being replied to
    const getReplyingToUserNode = (): ReactNode => {
      if (!replyToItem) return null;

      const userId = getReplyToUserId();
      if (!userId) return 'Anonymous';

      // Return the full ReactNode from renderUser
      return renderUser(userId);
    };

    // Get the context content (the post being replied to or edited)
    const getContextContent = (): ReactNode => {
      if (editingItem) {
        // When editing, show the original content
        const discussion = discussions.find(
          (d) => d.id === editingItem.discussionId,
        );
        if (!discussion) return null;

        if (editingItem.commentId) {
          // Editing a comment
          const comment = discussion.comments.find(
            (c) => c.id === editingItem.commentId,
          );
          if (!comment) return null;

          return renderComment ? (
            renderComment({comment, renderUser, discussion})
          ) : (
            <div className="text-sm">{comment.text}</div>
          );
        } else {
          // Editing the root discussion
          return renderComment ? (
            renderComment({
              comment: discussion.rootComment,
              renderUser,
              discussion,
            })
          ) : (
            <div className="text-sm">{discussion.rootComment.text}</div>
          );
        }
      }

      if (replyToItem) {
        // When replying, show what we're replying to
        const discussion = discussions.find(
          (d) => d.id === replyToItem.discussionId,
        );
        if (!discussion) return null;

        if (replyToItem.commentId) {
          // Replying to a comment
          const comment = discussion.comments.find(
            (c) => c.id === replyToItem.commentId,
          );
          if (!comment) return null;

          return renderComment ? (
            renderComment({comment, renderUser, discussion})
          ) : (
            <div className="text-sm">{comment.text}</div>
          );
        } else {
          // Replying to the root discussion
          return renderComment ? (
            renderComment({
              comment: discussion.rootComment,
              renderUser,
              discussion,
            })
          ) : (
            <div className="text-sm">{discussion.rootComment.text}</div>
          );
        }
      }

      return null;
    };

    const contextContent = getContextContent();
    const editingContext = contextContent ? (
      <div className="bg-muted rounded border p-2">
        <div className="text-muted-foreground mb-2 text-xs">
          {replyToItem ? 'Replying to:' : 'Editing:'}
        </div>
        {contextContent}
      </div>
    ) : null;

    return (
      <div
        ref={ref}
        className={cn('flex h-full flex-col overflow-hidden', className)}
        {...props}
      >
        {/* Scrollable discussion list */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2 py-2">
            {discussions.map((discussion) => (
              <div
                key={discussion.id}
                data-discussion-id={discussion.id}
                ref={
                  highlightedDiscussionId === discussion.id
                    ? highlightedRef
                    : undefined
                }
                className={cn(
                  'flex flex-col gap-4 rounded border p-2',
                  highlightedDiscussionId === discussion.id &&
                    'border-blue-300 shadow-md transition-all duration-500',
                )}
              >
                <DiscussionItem
                  discussion={discussion}
                  renderUser={renderUser}
                  renderComment={renderComment}
                />
              </div>
            ))}

            {/* Add padding at the bottom to prevent content from being hidden behind sticky form */}
            <div className="h-20" />
          </div>
        </div>

        {/* Sticky form at the bottom */}
        <div className="bg-background sticky bottom-0 border-t p-2 shadow-lg">
          {editingContext}
          {/* Show editing form when editing */}
          {editingItem && (
            <EditCommentForm
              onSubmit={submitEdit}
              initialText={getEditingItemText()}
              submitLabel="Save"
              onCancel={() => {
                setEditingItem(undefined);
              }}
            />
          )}

          {/* Show reply form when replying */}
          {!editingItem && replyToItem && (
            <EditCommentForm
              onSubmit={submitEdit}
              initialText=""
              submitLabel="Reply"
              onCancel={() => {
                setReplyToItem(undefined);
              }}
            />
          )}

          {/* Show form for new discussions only when not replying or editing */}
          {!editingItem && !replyToItem && (
            <EditCommentForm
              onSubmit={submitEdit}
              initialText=""
              submitLabel="Post"
            />
          )}
        </div>

        <DeleteConfirmDialog
          open={!!itemToDelete}
          onOpenChange={(open) => {
            if (!open) setItemToDelete(undefined);
          }}
          onConfirm={handleDeleteConfirm}
          itemType={itemToDelete?.itemType || 'Item'}
        />
      </div>
    );
  },
);
DiscussionList.displayName = 'DiscussionList';
