import {cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {CommentItem} from './CommentItem';
import {CommentSchema} from '../AnnotationSlice';

export type CommentListProps = {
  annotationId: string;
  comments: CommentSchema[];
  className?: string;
};

export const CommentList = forwardRef<HTMLDivElement, CommentListProps>(
  ({annotationId, comments, className}, ref) => {
    if (comments.length === 0) return null;

    return (
      <div
        ref={ref}
        className={cn('ml-4 flex flex-col gap-2 border-l-2 pl-2', className)}
      >
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            annotationId={annotationId}
            comment={comment}
          />
        ))}
      </div>
    );
  },
);
CommentList.displayName = 'CommentList';
