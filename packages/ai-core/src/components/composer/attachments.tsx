import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  cn,
} from '@sqlrooms/ui';
import {FileTextIcon, ImageIcon, PaperclipIcon, XIcon} from 'lucide-react';
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
  getChatAttachmentText,
  isSupportedChatAttachment,
} from '../../chatAttachments';
import {ChatAttachmentPreview} from '../ChatAttachmentPreview';
import {useBlockSends} from './beforeSend';

const DEFAULT_IMAGE_ACCEPT = 'image/*';
const DEFAULT_TEXT_ACCEPT =
  '.txt,.md,.markdown,.mdown,.mkd,text/plain,text/markdown';
const DEFAULT_MAX_FILES = 4;
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;
const DEFAULT_MAX_TEXT_FILE_SIZE = 128 * 1024;
const DEFAULT_MAX_TOTAL_TEXT_FILE_SIZE = 128 * 1024;

/** Transient files and actions shared by attachment UI under one chat root. */
export type ChatAttachmentsState = {
  /** Files waiting to be included in the next user message. */
  attachments: FileUIPart[];
  /** Adds already-serialized AI SDK file parts without asynchronous work. */
  append: (attachments: FileUIPart[]) => void;
  /**
   * Prepares files asynchronously and appends them only if the composer state
   * has not been cleared while the work is pending.
   *
   * @returns Whether the prepared attachments were still current and appended.
   */
  appendAsync: (prepare: () => Promise<FileUIPart[]>) => Promise<boolean>;
  /** Removes one pending file part by identity. */
  remove: (attachment: FileUIPart) => void;
  /** Removes every pending attachment. */
  clear: () => void;
};

const ChatAttachmentsContext = createContext<ChatAttachmentsState | null>(null);

function useChatAttachmentsContext(): ChatAttachmentsState {
  const value = useContext(ChatAttachmentsContext);
  if (!value) {
    throw new Error(
      'useChatAttachments must be used under Chat.Root, Chat.LocalAgentRoot, or ChatComposerStateBoundary.',
    );
  }
  return value;
}

/** Holds transient attachments for one chat composer tree. */
export const ChatComposerAttachmentsProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const inherited = useContext(ChatAttachmentsContext);
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const revisionRef = useRef(0);

  const append = useCallback((next: FileUIPart[]) => {
    setAttachments((current) => [...current, ...next]);
  }, []);
  const appendAsync = useCallback(
    async (prepare: () => Promise<FileUIPart[]>): Promise<boolean> => {
      const revision = revisionRef.current;
      const next = await prepare();
      if (revisionRef.current !== revision) return false;
      if (next.length > 0) {
        setAttachments((current) => [...current, ...next]);
      }
      return true;
    },
    [],
  );
  const remove = useCallback((attachment: FileUIPart) => {
    setAttachments((current) => current.filter((item) => item !== attachment));
  }, []);
  const clear = useCallback(() => {
    revisionRef.current += 1;
    setAttachments([]);
  }, []);
  const value = useMemo(
    () => ({
      attachments,
      append,
      appendAsync,
      remove,
      clear,
    }),
    [attachments, append, appendAsync, remove, clear],
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
  return useChatAttachmentsContext();
}

/**
 * Configuration for the opt-in composer attachment picker.
 *
 * By default it accepts up to four files, limits images to 2 MiB each, and
 * limits plain-text or Markdown files to 128 KiB each and in aggregate.
 * Unsupported, oversized, or excess files are rejected and reported through
 * {@link onError}.
 */
export type ChatComposerAttachmentsProps = {
  className?: string;
  /** Native file-input accept value for the image choice. */
  imageAccept?: string;
  /** Native file-input accept value for the text or Markdown choice. */
  textAccept?: string;
  /** Maximum number of files waiting in the composer. */
  maxFiles?: number;
  /** Maximum image size in bytes. */
  maxFileSize?: number;
  /** Maximum text or Markdown size in bytes. */
  maxTextFileSize?: number;
  /** Maximum combined size of pending text and Markdown files in bytes. */
  maxTotalTextFileSize?: number;
  /** Called when one or more selected files cannot be attached. */
  onError?: (message: string) => void;
};

/**
 * Opt-in attachment controls for {@link QueryControls}. Add as a
 * `Chat.Composer` child to enable image and text/Markdown attachments.
 */
export const Attachments: FC<ChatComposerAttachmentsProps> = ({
  className,
  imageAccept = DEFAULT_IMAGE_ACCEPT,
  textAccept = DEFAULT_TEXT_ACCEPT,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxTextFileSize = DEFAULT_MAX_TEXT_FILE_SIZE,
  maxTotalTextFileSize = DEFAULT_MAX_TOTAL_TEXT_FILE_SIZE,
  onError,
}) => {
  const attachmentState = useChatAttachmentsContext();
  const {attachments, appendAsync, remove} = attachmentState;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
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
      let totalTextFileSize = attachments.reduce((total, attachment) => {
        const text = getChatAttachmentText(attachment);
        return text === undefined
          ? total
          : total + new TextEncoder().encode(text).byteLength;
      }, 0);
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
        if (isText && totalTextFileSize + file.size > maxTotalTextFileSize) {
          reportError(
            `${file.name} exceeds the combined text attachment limit.`,
          );
          continue;
        }
        if (isText) totalTextFileSize += file.size;
        accepted.push(file);
      }
      if (files.length > remaining) {
        reportError(`You can attach up to ${maxFiles} files.`);
      }
      if (accepted.length === 0) return;

      setIsReading(true);
      try {
        await appendAsync(() =>
          Promise.all(accepted.map(fileToChatAttachmentPart)),
        );
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
      attachments,
      appendAsync,
      maxFiles,
      maxFileSize,
      maxTextFileSize,
      maxTotalTextFileSize,
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
        ref={imageInputRef}
        type="file"
        className="sr-only"
        accept={imageAccept}
        multiple
        onChange={handleChange}
        aria-label="Attach image files"
      />
      <input
        ref={textInputRef}
        type="file"
        className="sr-only"
        accept={textAccept}
        multiple
        onChange={handleChange}
        aria-label="Attach text or Markdown files"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Attach files"
            title="Attach files"
            disabled={isReading || attachments.length >= maxFiles}
          >
            <PaperclipIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Supported files
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="items-start gap-2 p-2"
            onSelect={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="mt-0.5" />
            <span className="grid gap-0.5">
              <span>Image</span>
              <span className="text-muted-foreground text-xs font-normal">
                Any image format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="items-start gap-2 p-2"
            onSelect={() => textInputRef.current?.click()}
          >
            <FileTextIcon className="mt-0.5" />
            <span className="grid gap-0.5">
              <span>Text or Markdown</span>
              <span className="text-muted-foreground text-xs font-normal">
                .txt, .md, .markdown, .mdown, .mkd
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
