import {cn} from '@sqlrooms/ui';
import {ComponentPropsWithoutRef, forwardRef, ReactNode} from 'react';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';
import {DiscussionItem} from './components/DiscussionItem';
import {EditCommentForm} from './components/EditCommentForm';
import type {CommentSchema} from './DiscussionSlice';
import {useStoreWithDiscussion} from './DiscussionSlice';
import {defaultRenderUser} from './components/CommentItem';

// Main DiscussionList component
type DiscussionListProps = ComponentPropsWithoutRef<'div'> & {
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: CommentSchema;
    renderUser: (userId: string) => ReactNode;
  }) => ReactNode;
};

export const DiscussionList = forwardRef<HTMLDivElement, DiscussionListProps>(
  (
    {className, renderUser = defaultRenderUser, renderComment, ...props},
    ref,
  ) => {
    const discussions = useStoreWithDiscussion(
      (state) => state.discussion.discussions,
    );
    const replyToItem = useStoreWithDiscussion(
      (state) => state.discussion.replyToItem,
    );
    const editingItem = useStoreWithDiscussion(
      (state) => state.discussion.editingItem,
    );
    const itemToDelete = useStoreWithDiscussion(
      (state) => state.discussion.itemToDelete,
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
    const submitEdit = useStoreWithDiscussion(
      (state) => state.discussion.submitEdit,
    );
    const handleDeleteConfirm = useStoreWithDiscussion(
      (state) => state.discussion.handleDeleteConfirm,
    );
    const getReplyToUserId = useStoreWithDiscussion(
      (state) => state.discussion.getReplyToUserId,
    );
    const getEditingItemText = useStoreWithDiscussion(
      (state) => state.discussion.getEditingItemText,
    );

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
        className={cn('flex flex-col gap-2', className)}
        {...props}
      >
        {discussions.map((discussion) => (
          <div
            key={discussion.id}
            className="flex flex-col gap-4 rounded border p-2"
          >
            <DiscussionItem
              discussion={discussion}
              renderUser={renderUser}
              renderComment={renderComment}
            />
          </div>
        ))}

        <DeleteConfirmDialog
          open={!!itemToDelete}
          onOpenChange={(open) => {
            if (!open) setItemToDelete(undefined);
          }}
          onConfirm={handleDeleteConfirm}
          itemType={itemToDelete?.itemType || 'Item'}
        />

        <EditCommentForm
          onSubmit={submitEdit}
          initialText={editingItem ? getEditingItemText() : ''}
          submitLabel={editingItem ? 'Save' : replyToItem ? 'Reply' : 'Add'}
          replyingTo={replyToItem ? getReplyingToUserNode() : undefined}
          editingType={
            editingItem
              ? editingItem.commentId
                ? 'comment'
                : 'discussion'
              : undefined
          }
          onCancel={() => {
            setReplyToItem(undefined);
            setEditingItem(undefined);
          }}
        />
      </div>
    );
  },
);
DiscussionList.displayName = 'DiscussionList';
