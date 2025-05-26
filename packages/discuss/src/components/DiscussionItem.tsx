import {cn} from '@sqlrooms/ui';
import {forwardRef, ReactNode} from 'react';
import type {Discussion} from '../DiscussSlice';
import {CommentItem, CommentItemProps, defaultRenderUser} from './CommentItem';

export type DiscussionItemProps = {
  discussion: Discussion;
  className?: string;
  renderUser?: (userId: string) => ReactNode;
  renderComment?: CommentItemProps['renderComment'];
};

export const DiscussionItem = forwardRef<HTMLDivElement, DiscussionItemProps>(
  (
    {discussion, className, renderUser = defaultRenderUser, renderComment},
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
          renderComment={
            renderComment
              ? (props) => renderComment({...props, discussion})
              : undefined
          }
        />

        {/* Replies */}
        {discussion.comments.length > 0 && (
          <div className="border-muted ml-6 flex flex-col gap-4 border-l-2 pl-4">
            {discussion.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                discussionId={discussion.id}
                comment={comment}
                renderUser={renderUser}
                renderComment={renderComment}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
DiscussionItem.displayName = 'DiscussionItem';
