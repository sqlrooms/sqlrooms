import {Button, cn, Textarea} from '@sqlrooms/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@sqlrooms/ui';
import {useState, forwardRef, ComponentPropsWithoutRef} from 'react';
import {
  useStoreWithAnnotation,
  type AnnotationSchema,
  type CommentSchema as CommentType,
} from './AnnotationSlice';
import {formatTimeRelative} from '@sqlrooms/utils';

// AnnotationItem component
type AnnotationItemProps = {
  annotation: AnnotationSchema;
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string) => void;
  onEdit: (annotationId: string, text: string) => void;
  onDelete: (annotationId: string) => void;
  className?: string;
};

const AnnotationItem = ({
  annotation,
  userId,
  getUserName,
  onReply,
  onEdit,
  onDelete,
  className,
}: AnnotationItemProps) => {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="text-muted-foreground text-xs">
        {getUserName(annotation.userId)} -{' '}
        {formatTimeRelative(annotation.timestamp)}
      </div>
      <div className="whitespace-pre-wrap">{annotation.text}</div>
      <div className="mt-1 flex justify-end gap-1 text-xs">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onReply(annotation.id)}
        >
          Reply
        </Button>
        {annotation.userId === userId && (
          <>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(annotation.id, annotation.text)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDelete(annotation.id)}
            >
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// CommentItem component
type CommentItemProps = {
  annotationId: string;
  comment: CommentType;
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string, commentId: string) => void;
  onEdit: (annotationId: string, commentId: string, text: string) => void;
  onDelete: (annotationId: string, commentId: string) => void;
  className?: string;
};

const CommentItem = ({
  annotationId,
  comment,
  userId,
  getUserName,
  onReply,
  onEdit,
  onDelete,
  className,
}: CommentItemProps) => {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="text-muted-foreground text-xs">
        {getUserName(comment.userId)} - {formatTimeRelative(comment.timestamp)}
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
};

// CommentList component
type CommentListProps = {
  annotationId: string;
  comments: CommentType[];
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string, commentId: string) => void;
  onEdit: (annotationId: string, commentId: string, text: string) => void;
  onDelete: (annotationId: string, commentId: string) => void;
  className?: string;
};

const CommentList = ({
  annotationId,
  comments,
  userId,
  getUserName,
  onReply,
  onEdit,
  onDelete,
  className,
}: CommentListProps) => {
  if (comments.length === 0) return null;

  return (
    <div className={cn('ml-4 flex flex-col gap-2 border-l-2 pl-2', className)}>
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
};

// AnnotationForm component
type AnnotationFormProps = Omit<ComponentPropsWithoutRef<'div'>, 'onSubmit'> & {
  onSubmit: (text: string) => void;
  initialText?: string;
  submitLabel?: string;
  replyingTo?: string;
  editingType?: string;
  onCancel?: () => void;
};

const AnnotationForm = forwardRef<HTMLDivElement, AnnotationFormProps>(
  (
    {
      onSubmit,
      initialText = '',
      submitLabel = 'Add',
      replyingTo,
      editingType,
      onCancel,
      className,
      ...props
    },
    ref,
  ) => {
    const [text, setText] = useState(initialText);

    const handleSubmit = () => {
      if (!text.trim()) return;
      onSubmit(text);
      setText('');
    };

    return (
      <div
        ref={ref}
        className={cn('mt-2 flex flex-col gap-2', className)}
        {...props}
      >
        {(replyingTo || editingType) && (
          <div className="text-muted-foreground text-xs">
            {replyingTo && `Replying to ${replyingTo}`}
            {editingType && `Editing ${editingType}`}
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        )}
        <Textarea
          className="min-h-[60px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button onClick={handleSubmit} className="self-end">
          {submitLabel}
        </Button>
      </div>
    );
  },
);
AnnotationForm.displayName = 'AnnotationForm';

// DeleteConfirmDialog component
type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemType: string;
};

const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  itemType,
}: DeleteConfirmDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {itemType}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {itemType.toLowerCase()}? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
