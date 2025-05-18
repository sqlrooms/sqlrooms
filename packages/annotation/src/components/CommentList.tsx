import {cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {CommentItem} from './CommentItem';
import {CommentSchema} from '../AnnotationSlice';

export type CommentListProps = {
  annotationId: string;
  comments: CommentSchema[];
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string, commentId: string) => void;
  onEdit: (annotationId: string, commentId: string, text: string) => void;
  onDelete: (annotationId: string, commentId: string) => void;
  className?: string;
};

export const CommentList = forwardRef<HTMLDivElement, CommentListProps>(
  (
    {
      annotationId,
      comments,
      userId,
      getUserName,
      onReply,
      onEdit,
      onDelete,
      className,
    },
    ref,
  ) => {
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
            userId={userId}
            getUserName={getUserName}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  },
);
CommentList.displayName = 'CommentList';
