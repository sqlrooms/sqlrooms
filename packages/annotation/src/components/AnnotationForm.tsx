import {Button, cn, Textarea} from '@sqlrooms/ui';
import {forwardRef, useState, ComponentPropsWithoutRef} from 'react';

export type AnnotationFormProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onSubmit'
> & {
  onSubmit: (text: string) => void;
  initialText?: string;
  submitLabel?: string;
  replyingTo?: string;
  editingType?: string;
  onCancel?: () => void;
};

export const AnnotationForm = forwardRef<HTMLDivElement, AnnotationFormProps>(
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
