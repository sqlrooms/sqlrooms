import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {CommentSchema} from '../AnnotationSlice';
import {useStoreWithAnnotation} from '../AnnotationSlice';

export type CommentItemProps = {
  annotationId: string;
  comment: CommentSchema;
  className?: string;
};

export const CommentItem = forwardRef<HTMLDivElement, CommentItemProps>(
  ({annotationId, comment, className}, ref) => {
    const userId = useStoreWithAnnotation((state) => state.annotation.userId);
    const getUserName = useStoreWithAnnotation(
      (state) => state.annotation.getUserName,
    );
    const setReplyToItem = useStoreWithAnnotation(
      (state) => state.annotation.setReplyToItem,
    );
    const setEditingItem = useStoreWithAnnotation(
      (state) => state.annotation.setEditingItem,
    );
    const setItemToDelete = useStoreWithAnnotation(
      (state) => state.annotation.setItemToDelete,
    );

    const handleReply = () => {
      setReplyToItem({annotationId, commentId: comment.id});
    };

    const handleEdit = () => {
      setEditingItem({annotationId, commentId: comment.id});
    };

    const handleDelete = () => {
      setItemToDelete({
        annotationId,
        commentId: comment.id,
        itemType: 'Comment',
      });
    };

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {getUserName(comment.userId)} -{' '}
          {formatTimeRelative(comment.timestamp)}
          {comment.parentId && ' (reply)'}
        </div>
        <div className="whitespace-pre-wrap">{comment.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button variant="ghost" size="xs" onClick={handleReply}>
            Reply
          </Button>
          {comment.userId === userId && (
            <>
              <Button variant="ghost" size="xs" onClick={handleEdit}>
                Edit
              </Button>
              <Button variant="ghost" size="xs" onClick={handleDelete}>
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
