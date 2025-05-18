import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {CommentSchema} from '../AnnotationSlice';

export type CommentItemProps = {
  annotationId: string;
  comment: CommentSchema;
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string, commentId: string) => void;
  onEdit: (annotationId: string, commentId: string, text: string) => void;
  onDelete: (annotationId: string, commentId: string) => void;
  className?: string;
};

export const CommentItem = forwardRef<HTMLDivElement, CommentItemProps>(
  (
    {
      annotationId,
      comment,
      userId,
      getUserName,
      onReply,
      onEdit,
      onDelete,
      className,
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {getUserName(comment.userId)} -{' '}
          {formatTimeRelative(comment.timestamp)}
          {comment.parentId && ' (reply)'}
        </div>
        <div className="whitespace-pre-wrap">{comment.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onReply(annotationId, comment.id)}
          >
            Reply
          </Button>
          {comment.userId === userId && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onEdit(annotationId, comment.id, comment.text)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDelete(annotationId, comment.id)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    );
  },
);
CommentItem.displayName = 'CommentItem';
