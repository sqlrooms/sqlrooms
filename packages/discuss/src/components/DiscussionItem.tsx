import {cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import type {Discussion} from '../DiscussSlice';
import {CommentItem, CommentItemProps} from './CommentItem';

export type DiscussionItemProps = {
  discussion: Discussion;
  className?: string;
  renderComment?: CommentItemProps['renderComment'];
};

export const DiscussionItem = forwardRef<HTMLDivElement, DiscussionItemProps>(
  ({discussion, className, renderComment}, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-4', className)}>
        {/* Root comment (the discussion itself) */}
        <CommentItem
          discussionId={discussion.id}
          comment={discussion.rootComment}
          isRootComment={true}
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
