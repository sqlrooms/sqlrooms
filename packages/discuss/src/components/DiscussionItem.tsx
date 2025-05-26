import {cn} from '@sqlrooms/ui';
import React, {forwardRef, ReactNode} from 'react';
import type {Discussion} from '../DiscussSlice';
import {CommentItemProps, defaultRenderComment} from './CommentItem';

export type DiscussionItemProps = {
  discussion: Discussion;
  className?: string;
  renderComment?: (props: CommentItemProps) => ReactNode;
};

export const DiscussionItem = forwardRef<HTMLDivElement, DiscussionItemProps>(
  ({discussion, className, renderComment = defaultRenderComment}, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-4', className)}>
        {/* Root comment (the discussion itself) */}
        {renderComment({
          discussion,
          comment: discussion.rootComment,
          isRootComment: true,
        })}

        {/* Replies */}
        {discussion.comments.length > 0 && (
          <div className="border-muted ml-6 flex flex-col gap-4 border-l-2 pl-4">
            {discussion.comments.map((comment) => (
              <React.Fragment key={comment.id}>
                {renderComment({discussion, comment, isRootComment: false})}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  },
);
DiscussionItem.displayName = 'DiscussionItem';
