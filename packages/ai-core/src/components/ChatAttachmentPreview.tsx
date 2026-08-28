import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
} from '@sqlrooms/ui';
import {FileTextIcon} from 'lucide-react';
import {useMemo, useState, type FC} from 'react';
import type {ChatAttachmentPart} from '../chatAttachments';
import {getChatAttachmentText, isMarkdownAttachment} from '../chatAttachments';
import {MessageContent} from './MessageContent';

/** Props for a clickable image or text/Markdown attachment preview. */
export type ChatAttachmentPreviewProps = {
  /** Serialized attachment displayed by the preview and its dialog. */
  attachment: ChatAttachmentPart;
  /** Use the smaller composer-chip presentation. */
  compact?: boolean;
};

/** Clickable attachment preview with an image or text/Markdown dialog. */
export const ChatAttachmentPreview: FC<ChatAttachmentPreviewProps> = ({
  attachment,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const isImage = attachment.mediaType.startsWith('image/');
  const text = useMemo(() => getChatAttachmentText(attachment), [attachment]);
  const filename = attachment.filename ?? (isImage ? 'Image' : 'Text file');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className={cn(
          'hover:bg-muted/70 focus-visible:ring-ring flex overflow-hidden rounded-md text-left outline-none focus-visible:ring-2',
          compact ? 'h-9 max-w-44 items-center gap-2 pr-2' : 'max-w-56',
        )}
        aria-label={`Open ${filename}`}
        onClick={() => setOpen(true)}
      >
        {isImage ? (
          <img
            src={attachment.url}
            alt={filename}
            className={cn(
              'bg-muted object-cover',
              compact ? 'h-9 w-9' : 'h-24 w-32',
            )}
          />
        ) : (
          <>
            <span
              className={cn(
                'bg-muted flex shrink-0 items-center justify-center',
                compact ? 'h-9 w-9' : 'h-24 w-16',
              )}
            >
              <FileTextIcon className="text-muted-foreground h-5 w-5" />
            </span>
            <span className="min-w-0 truncate text-xs">{filename}</span>
          </>
        )}
      </button>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">{filename}</DialogTitle>
          <DialogDescription>
            {isImage ? 'Attached image preview' : 'Attached text file preview'}
          </DialogDescription>
        </DialogHeader>
        {isImage ? (
          <div className="flex min-h-0 items-center justify-center overflow-auto">
            <img
              src={attachment.url}
              alt={filename}
              className="max-h-[75vh] max-w-full object-contain"
            />
          </div>
        ) : text === undefined ? (
          <p className="text-muted-foreground text-sm">
            This text attachment could not be decoded.
          </p>
        ) : isMarkdownAttachment(attachment) ? (
          <div className="min-h-0 overflow-auto rounded-md border p-4">
            <MessageContent content={text} isAnswer />
          </div>
        ) : (
          <pre className="bg-muted min-h-0 overflow-auto rounded-md border p-4 text-sm whitespace-pre-wrap">
            {text}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
};
