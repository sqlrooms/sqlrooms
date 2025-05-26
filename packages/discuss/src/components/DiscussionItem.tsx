import {cn} from '@sqlrooms/ui';
import {forwardRef, ReactNode} from 'react';
import type {
  Discussion,
  Comment,
  EditingItem,
  ReplyToItem,
} from '../DiscussSlice';
import {CommentItem, defaultRenderUser} from './CommentItem';
import {EditCommentForm} from './EditCommentForm';

export type DiscussionItemProps = {
  discussion: Discussion;
  className?: string;
  renderUser?: (userId: string) => ReactNode;
  renderComment?: (props: {
    comment: Comment;
    renderUser: (userId: string) => ReactNode;
  }) => ReactNode;
  editingItem?: EditingItem;
  submitEdit?: (text: string) => void;
  getEditingItemText?: () => string;
  setEditingItem?: (editingItem: EditingItem | undefined) => void;
  replyToItem?: ReplyToItem;
  setReplyToItem?: (replyToItem: ReplyToItem | undefined) => void;
  getReplyingToUserNode?: () => ReactNode;
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
      replyToItem,
      setReplyToItem,
      getReplyingToUserNode,
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
            {discussion.comments.map((comment) => (
              <div key={comment.id} className="flex flex-col gap-4">
                {editingItem &&
                editingItem.commentId === comment.id &&
                editingItem.discussionId === discussion.id &&
                submitEdit &&
                getEditingItemText &&
                setEditingItem ? (
                  <EditCommentForm
                    onSubmit={submitEdit}
                    initialText={getEditingItemText()}
                    submitLabel="Save"
                    editingType="comment"
                    onCancel={() => setEditingItem(undefined)}
                  />
                ) : (
                  <CommentItem
                    discussionId={discussion.id}
                    comment={comment}
                    renderUser={renderUser}
                    renderComment={renderComment}
                  />
                )}

                {/* Show reply form after comment if replying to this specific comment */}
                {replyToItem &&
                  replyToItem.commentId === comment.id &&
                  replyToItem.discussionId === discussion.id &&
                  submitEdit &&
                  setReplyToItem &&
                  getReplyingToUserNode && (
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
          </div>
        )}
      </div>
    );
  },
);
DiscussionItem.displayName = 'DiscussionItem';
