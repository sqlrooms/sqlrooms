import {Button, Textarea} from '@sqlrooms/ui';
import {useState} from 'react';
import {useStoreWithAnnotation} from './AnnotationSlice.js';

export const AnnotationList: React.FC = () => {
  const threads = useStoreWithAnnotation((s) => s.annotation.threads);
  const userId = useStoreWithAnnotation((s) => s.annotation.userId);
  const addAnnotation = useStoreWithAnnotation((s) => s.annotation.addAnnotation);
  const editAnnotation = useStoreWithAnnotation(
    (s) => s.annotation.editAnnotation,
  );
  const removeAnnotation = useStoreWithAnnotation(
    (s) => s.annotation.removeAnnotation,
  );

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [editId, setEditId] = useState<string | undefined>(undefined);

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
    <div className="flex flex-col gap-2">
      {threads.map((thread) => (
        <div key={thread.annotations[0].id} className="rounded border p-2">
          {thread.annotations.map((a) => (
            <div key={a.id} className="mb-2">
              <div className="text-xs text-muted-foreground">
                {a.userId} - {a.timestamp.toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap">{a.text}</div>
              <div className="mt-1 flex gap-2 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyTo(a.id)}
                >
                  Reply
                </Button>
                {a.userId === userId && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditId(a.id);
                        setText(a.text);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAnnotation(a.id)}
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

      <div className="mt-2 flex flex-col gap-2">
        {replyTo && (
          <div className="text-xs text-muted-foreground">
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
