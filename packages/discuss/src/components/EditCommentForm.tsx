import {Button, cn, Textarea} from '@sqlrooms/ui';
import {
  forwardRef,
  useState,
  useEffect,
  ComponentPropsWithoutRef,
  ReactNode,
} from 'react';

export type EditCommentFormProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onSubmit'
> & {
  onSubmit: (text: string) => void;
  initialText?: string;
  submitLabel?: string;
  replyingTo?: ReactNode;
  editingType?: string;
  onCancel?: () => void;
};

export const EditCommentForm = forwardRef<HTMLDivElement, EditCommentFormProps>(
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

    // Update text state when initialText changes
    useEffect(() => {
      setText(initialText);
    }, [initialText]);

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
            {replyingTo && (
              <span>
                Replying to{' '}
                <span className="inline-flex items-center">{replyingTo}</span>
              </span>
            )}
            {editingType && `Editing ${editingType}`}
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
        <div className="flex items-center gap-2 self-end">
          {(replyingTo || editingType) && onCancel && (
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} variant="outline" size="xs">
            {submitLabel}
          </Button>
        </div>
      </div>
    );
  },
);
EditCommentForm.displayName = 'EditCommentForm';
