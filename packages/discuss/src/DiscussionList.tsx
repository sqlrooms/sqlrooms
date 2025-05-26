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
import type {Comment} from './DiscussSlice';
import {useStoreWithDiscussion} from './DiscussSlice';

// Main DiscussionList component
type DiscussionListProps = ComponentPropsWithoutRef<'div'> & {
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: Comment;
    renderUser: (userId: string) => ReactNode;
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
    const userId = useStoreWithDiscussion((state) => state.discuss.userId);
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

    return (
      <div
        ref={ref}
        className={cn('flex h-full flex-col overflow-hidden', className)}
        {...props}
      >
        {/* Scrollable discussion list */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2 p-2">
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
                {editingItem &&
                !editingItem.commentId &&
                editingItem.discussionId === discussion.id &&
                discussion.rootComment.userId === userId ? (
                  <EditCommentForm
                    onSubmit={submitEdit}
                    initialText={getEditingItemText()}
                    submitLabel="Save"
                    editingType="discussion"
                    onCancel={() => {
                      setEditingItem(undefined);
                    }}
                  />
                ) : (
                  <DiscussionItem
                    discussion={discussion}
                    renderUser={renderUser}
                    renderComment={renderComment}
                    editingItem={editingItem}
                    submitEdit={submitEdit}
                    getEditingItemText={getEditingItemText}
                    setEditingItem={setEditingItem}
                    replyToItem={replyToItem}
                    setReplyToItem={setReplyToItem}
                    getReplyingToUserNode={getReplyingToUserNode}
                  />
                )}

                {/* Show reply form after discussion if replying to the root discussion */}
                {replyToItem &&
                  !replyToItem.commentId &&
                  replyToItem.discussionId === discussion.id && (
                    <EditCommentForm
                      onSubmit={submitEdit}
                      initialText=""
                      submitLabel="Reply"
                      replyingTo={getReplyingToUserNode()}
                      onCancel={() => {
                        setReplyToItem(undefined);
                      }}
                    />
                  )}
              </div>
            ))}

            {/* Add padding at the bottom to prevent content from being hidden behind sticky form */}
            <div className="h-20" />
          </div>
        </div>

        {/* Sticky form at the bottom */}
        <div className="bg-background sticky bottom-0 border-t p-2 shadow-lg">
          {/* Show form for new discussions only when not replying or editing */}
          {!editingItem && !replyToItem && (
            <EditCommentForm
              onSubmit={submitEdit}
              initialText=""
              submitLabel="Post"
              onCancel={() => {
                // No cancel action needed for new discussions
              }}
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
