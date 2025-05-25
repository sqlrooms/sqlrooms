import {cn} from '@sqlrooms/ui';
import {forwardRef, ReactNode} from 'react';
import type {
  DiscussionSchema,
  CommentSchema,
  EditingItem,
} from '../DiscussionSlice';
import {CommentItem, defaultRenderUser} from './CommentItem';
import {EditCommentForm} from './EditCommentForm';

export type DiscussionItemProps = {
  discussion: DiscussionSchema;
  className?: string;
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: CommentSchema;
    renderUser: (userId: string) => ReactNode;
  }) => ReactNode;
  editingItem?: EditingItem;
  submitEdit?: (text: string) => void;
  getEditingItemText?: () => string;
  setEditingItem?: (editingItem: EditingItem | undefined) => void;
};

export const DiscussionItem = forwardRef<HTMLDivElement, DiscussionItemProps>(
  (
    {
      discussion,
      className,
      renderUser = defaultRenderUser,
      renderComment,
      editingItem,
      submitEdit,
      getEditingItemText,
      setEditingItem,
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-4', className)}>
        {/* Root comment (the discussion itself) */}
        <CommentItem
          discussionId={discussion.id}
          comment={discussion.rootComment}
          isRootComment={true}
          renderUser={renderUser}
          renderComment={renderComment}
        />

        {/* Replies */}
        {discussion.comments.length > 0 && (
          <div className="border-muted ml-6 flex flex-col gap-4 border-l-2 pl-4">
            {discussion.comments.map((comment) =>
              editingItem &&
              editingItem.commentId === comment.id &&
              editingItem.discussionId === discussion.id &&
              submitEdit &&
              getEditingItemText &&
              setEditingItem ? (
                <EditCommentForm
                  key={comment.id}
                  onSubmit={submitEdit}
                  initialText={getEditingItemText()}
                  submitLabel="Save"
                  editingType="comment"
                  onCancel={() => setEditingItem(undefined)}
                />
              ) : (
                <CommentItem
                  key={comment.id}
                  discussionId={discussion.id}
                  comment={comment}
                  renderUser={renderUser}
                  renderComment={renderComment}
                />
              ),
            )}
          </div>
        )}
      </div>
    );
  },
);
DiscussionItem.displayName = 'DiscussionItem';
