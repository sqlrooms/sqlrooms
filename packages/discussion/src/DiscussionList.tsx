import {cn} from '@sqlrooms/ui';
import {ComponentPropsWithoutRef, forwardRef} from 'react';
import {useStoreWithDiscussion} from './DiscussionSlice';
import {EditCommentForm} from './components/EditCommentForm';
import {DiscussionItem} from './components/DiscussionItem';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';

// Main DiscussionList component
type DiscussionListProps = ComponentPropsWithoutRef<'div'>;

export const DiscussionList = forwardRef<HTMLDivElement, DiscussionListProps>(
  ({className, ...props}, ref) => {
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
    const getReplyingToName = useStoreWithDiscussion(
      (state) => state.discussion.getReplyingToName,
    );

    // Get the text of the item being edited
    const getEditingItemText = () => {
      if (!editingItem) return '';

      // Look for the discussion
      const discussion = discussions.find(
        (a) => a.id === editingItem.discussionId,
      );
      if (!discussion) return '';

      // If editing a comment, find the comment
      if (editingItem.commentId) {
        const comment = discussion.comments.find(
          (c) => c.id === editingItem.commentId,
        );
        return comment ? comment.text : '';
      }

      // If editing the discussion itself
      return discussion.rootComment.text;
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
            <DiscussionItem discussion={discussion} />
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
          replyingTo={replyToItem ? getReplyingToName() : undefined}
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
