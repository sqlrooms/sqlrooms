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

export const AnnotationList: React.FC<{className?: string}> = ({className}) => {
  const threads = useStoreWithAnnotation((s) => s.annotation.threads);
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

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [annotationToDelete, setAnnotationToDelete] = useState<
    string | undefined
  >(undefined);

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (editId) {
      editAnnotation(editId, text);
      setEditId(undefined);
    } else {
      addAnnotation(text, replyTo);
      setReplyTo(undefined);
    }
    setText('');
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {threads.map((thread) => (
        <div key={thread.annotations[0]?.id} className="rounded border p-2">
          {thread.annotations.map((a) => (
            <div key={a.id}>
              <div className="text-muted-foreground text-xs">
                {a.userId} - {formatTimeRelative(a.timestamp)}
              </div>
              <div className="whitespace-pre-wrap">{a.text}</div>
              <div className="mt-1 flex justify-end gap-1 text-xs">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setReplyTo(a.id)}
                >
                  Reply
                </Button>
                {a.userId === userId && (
                  <>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditId(a.id);
                        setText(a.text);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setAnnotationToDelete(a.id)}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!annotationToDelete}
        onOpenChange={(open) => {
          if (!open) setAnnotationToDelete(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Annotation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this annotation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnnotationToDelete(undefined)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (annotationToDelete) removeAnnotation(annotationToDelete);
                setAnnotationToDelete(undefined);
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
            Replying to {replyTo}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyTo(undefined)}
            >
              Cancel
            </Button>
          </div>
        )}
        <Textarea
          className="min-h-[60px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button onClick={handleSubmit} className="self-end">
          {editId ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
};
