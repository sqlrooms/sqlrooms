import type {FileUIPart, UIMessage} from 'ai';

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd'];
const TEXT_EXTENSIONS = ['.txt', ...MARKDOWN_EXTENSIONS];

/** File part accepted and rendered by SQLRooms chat attachment surfaces. */
export type ChatAttachmentPart = FileUIPart;

/** Whether a media type represents plain text or Markdown. */
export function isTextAttachmentMediaType(mediaType: string): boolean {
  return (
    mediaType === 'text/plain' ||
    mediaType === 'text/markdown' ||
    mediaType === 'text/x-markdown'
  );
}

/** Whether a filename has a supported plain-text or Markdown extension. */
export function isTextAttachmentFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Whether an attachment should be rendered as Markdown. */
export function isMarkdownAttachment(attachment: ChatAttachmentPart): boolean {
  const filename = attachment.filename?.toLowerCase() ?? '';
  return (
    attachment.mediaType === 'text/markdown' ||
    attachment.mediaType === 'text/x-markdown' ||
    MARKDOWN_EXTENSIONS.some((extension) => filename.endsWith(extension))
  );
}

/** Whether a browser file is supported by the default attachment picker. */
export function isSupportedChatAttachment(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    isTextAttachmentMediaType(file.type) ||
    isTextAttachmentFilename(file.name)
  );
}

/** Supplies a useful media type when a browser leaves `File.type` empty. */
export function getChatAttachmentMediaType(file: File): string {
  const lower = file.name.toLowerCase();
  if (MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return 'text/markdown';
  }
  if (lower.endsWith('.txt')) return 'text/plain';
  if (file.type) return file.type;
  return 'application/octet-stream';
}

/** Reads a browser file into the serializable AI SDK file-part shape. */
export async function fileToChatAttachmentPart(
  file: File,
): Promise<ChatAttachmentPart> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read ${file.name}`));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

  return {
    type: 'file',
    mediaType: getChatAttachmentMediaType(file),
    filename: file.name,
    url,
  };
}

/** Decodes the text payload from a base64 or percent-encoded data URL. */
export function getChatAttachmentText(
  attachment: ChatAttachmentPart,
): string | undefined {
  if (!isTextAttachmentMediaType(attachment.mediaType)) return undefined;
  const commaIndex = attachment.url.indexOf(',');
  if (commaIndex < 0) return undefined;

  const header = attachment.url.slice(0, commaIndex);
  const data = attachment.url.slice(commaIndex + 1);

  try {
    if (!header.includes(';base64')) return decodeURIComponent(data);
    const binary = globalThis.atob(data);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/** Returns the file parts attached to a UI message. */
export function getChatMessageAttachments(
  message: UIMessage | undefined,
): ChatAttachmentPart[] {
  if (!message) return [];
  return message.parts.filter(
    (part): part is ChatAttachmentPart =>
      part.type === 'file' && typeof part.url === 'string',
  );
}

/**
 * Turns a text attachment into a labeled text part for provider-independent
 * model input while leaving the persisted UI message untouched.
 */
export function textAttachmentToModelText(
  attachment: ChatAttachmentPart,
): string | undefined {
  const text = getChatAttachmentText(attachment);
  if (text === undefined) return undefined;
  const filename = (attachment.filename ?? 'attachment.txt').replace(
    /[\r\n]+/g,
    ' ',
  );
  return `Attached file: ${filename}\n\n${text}`;
}
