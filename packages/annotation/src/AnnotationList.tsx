import {cn} from '@sqlrooms/ui';
import {ComponentPropsWithoutRef, forwardRef, useState} from 'react';
import {useStoreWithAnnotation} from './AnnotationSlice';
import {AnnotationForm} from './components/AnnotationForm';
import {AnnotationItem} from './components/AnnotationItem';
import {CommentList} from './components/CommentList';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';

// Main AnnotationList component
type AnnotationListProps = ComponentPropsWithoutRef<'div'> & {
  getUserName: (userId: string) => string;
};

export const AnnotationList = forwardRef<HTMLDivElement, AnnotationListProps>(
  ({className, getUserName, ...props}, ref) => {
    const annotations = useStoreWithAnnotation((s) => s.annotation.annotations);
    const userId = useStoreWithAnnotation((s) => s.annotation.userId);
    const addAnnotation = useStoreWithAnnotation(
      (s) => s.annotation.addAnnotation,
    );
    const editAnnotation = useStoreWithAnnotation(
      (s) => s.annotation.editAnnotation,
    );
    const removeAnnotation = useStoreWithAnnotation(
      (s) => s.annotation.removeAnnotation,
    );
    const addComment = useStoreWithAnnotation((s) => s.annotation.addComment);
    const editComment = useStoreWithAnnotation((s) => s.annotation.editComment);
    const removeComment = useStoreWithAnnotation(
      (s) => s.annotation.removeComment,
    );

    const [replyTo, setReplyTo] = useState<
      {annotationId: string; commentId?: string} | undefined
    >(undefined);
    const [editing, setEditing] = useState<
      {annotationId: string; commentId?: string} | undefined
    >(undefined);
    const [itemToDelete, setItemToDelete] = useState<
      {annotationId: string; commentId?: string; itemType: string} | undefined
    >(undefined);

    // Handler functions
    const handleAnnotationReply = (annotationId: string) => {
      setReplyTo({annotationId});
      setEditing(undefined);
    };

    const handleCommentReply = (annotationId: string, commentId: string) => {
      setReplyTo({annotationId, commentId});
      setEditing(undefined);
    };

    const handleAnnotationEdit = (annotationId: string, text: string) => {
      setEditing({annotationId});
      setReplyTo(undefined);
    };

    const handleCommentEdit = (
      annotationId: string,
      commentId: string,
      text: string,
    ) => {
      setEditing({annotationId, commentId});
      setReplyTo(undefined);
    };

    const handleAnnotationDelete = (annotationId: string) => {
      setItemToDelete({annotationId, itemType: 'Annotation'});
    };

    const handleCommentDelete = (annotationId: string, commentId: string) => {
      setItemToDelete({annotationId, commentId, itemType: 'Comment'});
    };

    const handleFormSubmit = (text: string) => {
      if (editing) {
        if (editing.commentId) {
          editComment(editing.annotationId, editing.commentId, text);
        } else {
          editAnnotation(editing.annotationId, text);
        }
        setEditing(undefined);
      } else if (replyTo) {
        if (replyTo.commentId) {
          addComment(replyTo.annotationId, text, replyTo.commentId);
        } else {
          addComment(replyTo.annotationId, text);
        }
        setReplyTo(undefined);
      } else {
        addAnnotation(text);
      }
    };

    const handleDeleteConfirm = () => {
      if (itemToDelete) {
        if (itemToDelete.commentId) {
          removeComment(itemToDelete.annotationId, itemToDelete.commentId);
        } else {
          removeAnnotation(itemToDelete.annotationId);
        }
      }
    };

    // Get the name of user being replied to
    const getReplyingToName = () => {
      if (!replyTo) return '';

      if (replyTo.commentId) {
        const annotation = annotations.find(
          (a) => a.id === replyTo.annotationId,
        );
        if (annotation) {
          const comment = annotation.comments.find(
            (c) => c.id === replyTo.commentId,
          );
          if (comment) return getUserName(comment.userId);
        }
      } else {
        const annotation = annotations.find(
          (a) => a.id === replyTo.annotationId,
        );
        if (annotation) return getUserName(annotation.userId);
      }
      return 'unknown';
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
            <AnnotationItem
              annotation={annotation}
              userId={userId}
              getUserName={getUserName}
              onReply={handleAnnotationReply}
              onEdit={handleAnnotationEdit}
              onDelete={handleAnnotationDelete}
            />

            <CommentList
              annotationId={annotation.id}
              comments={annotation.comments}
              userId={userId}
              getUserName={getUserName}
              onReply={handleCommentReply}
              onEdit={handleCommentEdit}
              onDelete={handleCommentDelete}
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
          onSubmit={handleFormSubmit}
          submitLabel={editing ? 'Save' : replyTo ? 'Reply' : 'Add'}
          replyingTo={replyTo ? getReplyingToName() : undefined}
          editingType={
            editing ? (editing.commentId ? 'comment' : 'annotation') : undefined
          }
          onCancel={() => {
            setReplyTo(undefined);
            setEditing(undefined);
          }}
        />
      </div>
    );
  },
);
AnnotationList.displayName = 'AnnotationList';
