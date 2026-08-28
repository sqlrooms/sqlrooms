import {Button, cn} from '@sqlrooms/ui';
import {PaperclipIcon, XIcon} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
  type PropsWithChildren,
} from 'react';
import type {FileUIPart} from 'ai';
import {
  fileToChatAttachmentPart,
  getChatAttachmentMediaType,
  isSupportedChatAttachment,
} from '../../chatAttachments';
import {ChatAttachmentPreview} from '../ChatAttachmentPreview';
import {useBlockSends} from './beforeSend';

const DEFAULT_ACCEPT = 'image/*,.txt,.md,.markdown,text/plain,text/markdown';
const DEFAULT_MAX_FILES = 8;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_TEXT_FILE_SIZE = 1024 * 1024;

/** Transient files and actions shared by attachment UI under one chat root. */
export type ChatAttachmentsState = {
  /** Files waiting to be included in the next user message. */
  attachments: FileUIPart[];
  /** Adds already-serialized AI SDK file parts. */
  append: (attachments: FileUIPart[]) => void;
  /** Removes one pending file part by identity. */
  remove: (attachment: FileUIPart) => void;
  /** Removes every pending attachment. */
  clear: () => void;
};

const ChatAttachmentsContext = createContext<ChatAttachmentsState | null>(null);

/** Holds transient attachments for one chat composer tree. */
export const ChatComposerAttachmentsProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const inherited = useContext(ChatAttachmentsContext);
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);

  const append = useCallback((next: FileUIPart[]) => {
    setAttachments((current) => [...current, ...next]);
  }, []);
  const remove = useCallback((attachment: FileUIPart) => {
    setAttachments((current) => current.filter((item) => item !== attachment));
  }, []);
  const clear = useCallback(() => setAttachments([]), []);
  const value = useMemo(
    () => ({attachments, append, remove, clear}),
    [attachments, append, remove, clear],
  );

  if (inherited) return <>{children}</>;
  return (
    <ChatAttachmentsContext.Provider value={value}>
      {children}
    </ChatAttachmentsContext.Provider>
  );
};

/** Reads and manages the transient attachments for the current composer. */
export function useChatAttachments(): ChatAttachmentsState {
  const value = useContext(ChatAttachmentsContext);
  if (!value) {
    throw new Error(
      'useChatAttachments must be used under Chat.Root, Chat.LocalAgentRoot, or ChatComposerStateBoundary.',
    );
  }
  return value;
}

export type ChatComposerAttachmentsProps = {
  className?: string;
  /** Native file-input accept value. */
  accept?: string;
  /** Maximum number of files waiting in the composer. */
  maxFiles?: number;
  /** Maximum image size in bytes. */
  maxFileSize?: number;
  /** Maximum text or Markdown size in bytes. */
  maxTextFileSize?: number;
  /** Called when one or more selected files cannot be attached. */
  onError?: (message: string) => void;
};

/**
 * Opt-in attachment controls for {@link QueryControls}. Add as a
 * `Chat.Composer` child to enable image and text/Markdown attachments.
 */
export const Attachments: FC<ChatComposerAttachmentsProps> = ({
  className,
  accept = DEFAULT_ACCEPT,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxTextFileSize = DEFAULT_MAX_TEXT_FILE_SIZE,
  onError,
}) => {
  const {attachments, append, remove} = useChatAttachments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [isReading, setIsReading] = useState(false);

  useBlockSends(isReading);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      setError(undefined);
      const remaining = Math.max(0, maxFiles - attachments.length);
      if (remaining === 0) {
        reportError(`You can attach up to ${maxFiles} files.`);
        return;
      }

      const accepted: File[] = [];
      for (const file of files.slice(0, remaining)) {
        if (!isSupportedChatAttachment(file)) {
          reportError(`${file.name} is not a supported image or text file.`);
          continue;
        }
        const isText = !getChatAttachmentMediaType(file).startsWith('image/');
        const sizeLimit = isText ? maxTextFileSize : maxFileSize;
        if (file.size > sizeLimit) {
          reportError(`${file.name} is too large.`);
          continue;
        }
        accepted.push(file);
      }
      if (files.length > remaining) {
        reportError(`You can attach up to ${maxFiles} files.`);
      }
      if (accepted.length === 0) return;

      setIsReading(true);
      try {
        append(await Promise.all(accepted.map(fileToChatAttachmentPart)));
      } catch (readError) {
        reportError(
          readError instanceof Error
            ? readError.message
            : 'Could not read the selected file.',
        );
      } finally {
        setIsReading(false);
      }
    },
    [
      attachments.length,
      append,
      maxFiles,
      maxFileSize,
      maxTextFileSize,
      reportError,
    ],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      void addFiles(files);
    },
    [addFiles],
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        multiple
        onChange={handleChange}
        aria-label="Attach files"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        aria-label="Attach images or text files"
        title="Attach images or text files"
        disabled={isReading || attachments.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
      >
        <PaperclipIcon className="h-4 w-4" />
      </Button>
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.filename ?? 'attachment'}-${index}`}
          className="bg-background relative shrink-0 rounded-md border"
        >
          <ChatAttachmentPreview attachment={attachment} compact />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full"
            aria-label={`Remove ${attachment.filename ?? 'attachment'}`}
            onClick={() => remove(attachment)}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {error ? (
        <span
          className="text-destructive max-w-48 truncate text-xs"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
};
