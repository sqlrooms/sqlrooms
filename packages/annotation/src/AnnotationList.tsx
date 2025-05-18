import {cn} from '@sqlrooms/ui';
import {ComponentPropsWithoutRef, forwardRef} from 'react';
import {useStoreWithAnnotation} from './AnnotationSlice';
import {AnnotationForm} from './components/AnnotationForm';
import {AnnotationItem} from './components/AnnotationItem';
import {CommentList} from './components/CommentList';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';

// Main AnnotationList component
type AnnotationListProps = ComponentPropsWithoutRef<'div'>;

export const AnnotationList = forwardRef<HTMLDivElement, AnnotationListProps>(
  ({className, ...props}, ref) => {
    const annotations = useStoreWithAnnotation(
      (state) => state.annotation.annotations,
    );
    const replyToItem = useStoreWithAnnotation(
      (state) => state.annotation.replyToItem,
    );
    const editingItem = useStoreWithAnnotation(
      (state) => state.annotation.editingItem,
    );
    const itemToDelete = useStoreWithAnnotation(
      (state) => state.annotation.itemToDelete,
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
    const submitEdit = useStoreWithAnnotation(
      (state) => state.annotation.submitEdit,
    );
    const handleDeleteConfirm = useStoreWithAnnotation(
      (state) => state.annotation.handleDeleteConfirm,
    );
    const getReplyingToName = useStoreWithAnnotation(
      (state) => state.annotation.getReplyingToName,
    );

    // Get the text of the item being edited
    const getEditingItemText = () => {
      if (!editingItem) return '';

      // Look for the annotation
      const annotation = annotations.find(
        (a) => a.id === editingItem.annotationId,
      );
      if (!annotation) return '';

      // If editing a comment, find the comment
      if (editingItem.commentId) {
        const comment = annotation.comments.find(
          (c) => c.id === editingItem.commentId,
        );
        return comment ? comment.text : '';
      }

      // If editing the annotation itself
      return annotation.text;
    };

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      >
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            className="flex flex-col gap-4 rounded border p-2"
          >
            <AnnotationItem annotation={annotation} />

            <CommentList
              annotationId={annotation.id}
              comments={annotation.comments}
            />
          </div>
        ))}

        <DeleteConfirmDialog
          open={!!itemToDelete}
          onOpenChange={(open) => {
            if (!open) setItemToDelete(undefined);
          }}
          onConfirm={handleDeleteConfirm}
          itemType={itemToDelete?.itemType || 'Item'}
        />

        <AnnotationForm
          onSubmit={submitEdit}
          initialText={editingItem ? getEditingItemText() : ''}
          submitLabel={editingItem ? 'Save' : replyToItem ? 'Reply' : 'Add'}
          replyingTo={replyToItem ? getReplyingToName() : undefined}
          editingType={
            editingItem
              ? editingItem.commentId
                ? 'comment'
                : 'annotation'
              : undefined
          }
          onCancel={() => {
            setReplyToItem(undefined);
            setEditingItem(undefined);
          }}
        />
      </div>
    );
  },
);
AnnotationList.displayName = 'AnnotationList';
