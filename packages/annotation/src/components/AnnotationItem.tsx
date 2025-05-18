import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {AnnotationSchema} from '../AnnotationSlice';
import {useStoreWithAnnotation} from '../AnnotationSlice';

export type AnnotationItemProps = {
  annotation: AnnotationSchema;
  className?: string;
};

export const AnnotationItem = forwardRef<HTMLDivElement, AnnotationItemProps>(
  ({annotation, className}, ref) => {
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
      setReplyToItem({annotationId: annotation.id});
    };

    const handleEdit = () => {
      setEditingItem({annotationId: annotation.id});
    };

    const handleDelete = () => {
      setItemToDelete({annotationId: annotation.id, itemType: 'Annotation'});
    };

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {getUserName(annotation.userId)} -{' '}
          {formatTimeRelative(annotation.timestamp)}
        </div>
        <div className="whitespace-pre-wrap">{annotation.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button variant="ghost" size="xs" onClick={handleReply}>
            Reply
          </Button>
          {annotation.userId === userId && (
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
AnnotationItem.displayName = 'AnnotationItem';
