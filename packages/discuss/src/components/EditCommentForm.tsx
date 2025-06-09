import {Button, cn, Textarea} from '@sqlrooms/ui';
import {SendHorizonalIcon} from 'lucide-react';
import {
  ComponentPropsWithoutRef,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';

export type EditCommentFormProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onSubmit'
> & {
  onSubmit: (text: string) => void;
  initialText?: string;
  submitLabel?: string;
  onCancel?: () => void;
};

export const EditCommentForm = forwardRef<HTMLDivElement, EditCommentFormProps>(
  (
    {
      onSubmit,
      initialText = '',
      submitLabel = 'Post',
      onCancel,
      className,
      ...props
    },
    ref,
  ) => {
    const [text, setText] = useState(initialText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update text state when initialText changes
    useEffect(() => {
      setText(initialText);
    }, [initialText]);

    // Focus textarea when mounted
    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

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
        <Textarea
          ref={textareaRef}
          className="min-h-[60px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === 'Escape' && onCancel) {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <div className="flex items-center gap-2 self-end">
          {onCancel && (
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} variant="outline" size="xs">
            <SendHorizonalIcon className="h-4 w-4" />
            {submitLabel}
          </Button>
        </div>
      </div>
    );
  },
);
EditCommentForm.displayName = 'EditCommentForm';
