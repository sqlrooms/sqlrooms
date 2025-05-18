import {Button, cn, Textarea} from '@sqlrooms/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@sqlrooms/ui';
import {useState} from 'react';
import {useStoreWithAnnotation} from './AnnotationSlice.js';
import {formatTimeRelative} from '@sqlrooms/utils';

export const AnnotationList: React.FC<{
  className?: string;
  getUserName: (userId: string) => string;
}> = ({className, getUserName}) => {
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

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<
    {annotationId: string; commentId?: string} | undefined
  >(undefined);
  const [editing, setEditing] = useState<
    {annotationId: string; commentId?: string} | undefined
  >(undefined);
  const [itemToDelete, setItemToDelete] = useState<
    {annotationId: string; commentId?: string} | undefined
  >(undefined);

  const handleSubmit = () => {
    if (!text.trim()) return;

    if (editing) {
      if (editing.commentId) {
        editComment(editing.annotationId, editing.commentId, text);
      } else {
        editAnnotation(editing.annotationId, text);
      }
      setEditing(undefined);
    } else if (replyTo) {
      if (replyTo.commentId) {
        // Reply to a comment
        addComment(replyTo.annotationId, text, replyTo.commentId);
      } else {
        // Reply to the annotation
        addComment(replyTo.annotationId, text);
      }
      setReplyTo(undefined);
    } else {
      // New annotation
      addAnnotation(text);
    }

    setText('');
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className="flex flex-col gap-4 rounded border p-2"
        >
          {/* Annotation */}
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs">
              {getUserName(annotation.userId)} -{' '}
              {formatTimeRelative(annotation.timestamp)}
            </div>
            <div className="whitespace-pre-wrap">{annotation.text}</div>
            <div className="mt-1 flex justify-end gap-1 text-xs">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setReplyTo({annotationId: annotation.id})}
              >
                Reply
              </Button>
              {annotation.userId === userId && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setEditing({annotationId: annotation.id});
                      setText(annotation.text);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      setItemToDelete({annotationId: annotation.id})
                    }
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Comments */}
          {annotation.comments.length > 0 && (
            <div className="ml-4 flex flex-col gap-2 border-l-2 pl-2">
              {annotation.comments.map((comment) => (
                <div key={comment.id} className="flex flex-col gap-2">
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
                      onClick={() =>
                        setReplyTo({
                          annotationId: annotation.id,
                          commentId: comment.id,
                        })
                      }
                    >
                      Reply
                    </Button>
                    {comment.userId === userId && (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setEditing({
                              annotationId: annotation.id,
                              commentId: comment.id,
                            });
                            setText(comment.text);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setItemToDelete({
                              annotationId: annotation.id,
                              commentId: comment.id,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {itemToDelete?.commentId ? 'Comment' : 'Annotation'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this{' '}
              {itemToDelete?.commentId ? 'comment' : 'annotation'}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemToDelete(undefined)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToDelete) {
                  if (itemToDelete.commentId) {
                    removeComment(
                      itemToDelete.annotationId,
                      itemToDelete.commentId,
                    );
                  } else {
                    removeAnnotation(itemToDelete.annotationId);
                  }
                }
                setItemToDelete(undefined);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-2 flex flex-col gap-2">
        {replyTo && (
          <div className="text-muted-foreground text-xs">
            Replying to{' '}
            {(() => {
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
            })()}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyTo(undefined)}
            >
              Cancel
            </Button>
          </div>
        )}
        {editing && (
          <div className="text-muted-foreground text-xs">
            Editing {editing.commentId ? 'comment' : 'annotation'}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setText('');
              }}
            >
              Cancel
            </Button>
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
          {editing ? 'Save' : replyTo ? 'Reply' : 'Add'}
        </Button>
      </div>
    </div>
  );
};
