import {FC, useState} from 'react';
import {useDropzone} from 'react-dropzone';
import {Plus} from 'lucide-react';
import {cn, Spinner} from '@sqlrooms/ui';

/**
 * A customizable file dropzone component that handles file uploads through drag-and-drop or click interactions.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FileDropzone
 *   onDrop={async (files) => {
 *     console.log('Dropped files:', files);
 *     // Handle file upload
 *   }}
 * />
 *
 * // With file type restrictions and single file upload
 * <FileDropzone
 *   multiple={false}
 *   acceptedFormats={{
 *     'text/csv': ['.csv'],
 *     'application/json': ['.json']
 *   }}
 *   onDrop={async (files) => {
 *     const file = files[0];
 *     // Handle single file upload
 *   }}
 * >
 *   <p>Custom dropzone content</p>
 * </FileDropzone>
 * ```
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name for styling
 * @param props.isInvalid - Optional flag to indicate validation error state
 * @param props.onDrop - Async callback function called when files are dropped or selected
 * @param props.multiple - Optional flag to allow multiple file selection (default: true)
 * @param props.acceptedFormats - Optional object defining accepted MIME types and their extensions
 * @param props.children - Optional React nodes to render inside the dropzone
 */
export const FileDropzone: FC<{
  className?: string;
  isInvalid?: boolean;
  onDrop: (files: File[]) => Promise<void>;
  multiple?: boolean;
  acceptedFormats?: Record<string, string[]>;
  children?: React.ReactNode;
}> = (props) => {
  const {
    isInvalid,
    onDrop,
    multiple = true,
    className,
    acceptedFormats,
    children,
  } = props;

  const [isAddingDropped, setIsAddingDropped] = useState(false);

  const {getRootProps, getInputProps, isDragActive, open} = useDropzone({
    onDrop: async (files) => {
      setIsAddingDropped(true);
      try {
        await onDrop(files);
      } finally {
        setIsAddingDropped(false);
      }
    },
    accept: acceptedFormats,
    multiple,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div
      className={cn(
        'relative flex h-full min-h-[180px] cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-dashed p-2 transition-colors',
        isDragActive ? 'border-muted bg-muted/50' : 'border-muted',
        isInvalid && 'border-destructive',
        !isAddingDropped && 'hover:border-muted',
        className,
      )}
      {...getRootProps()}
      onClick={isAddingDropped ? undefined : open}
    >
      {isAddingDropped ? (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center gap-4 text-xs">
          <Spinner className="h-4 w-4" />
          Adding files...
        </div>
      ) : (
        <>
          <input {...getInputProps()} />
          <div className="relative flex h-full flex-col">
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-2">
                <Plus className="h-6 w-6" />
                <p className="text-muted-foreground text-sm">
                  {isDragActive ? 'Drop here ...' : 'Add files'}
                </p>
              </div>
              {acceptedFormats && (
                <div className="flex flex-wrap justify-center gap-2">
                  <p className="text-xs font-bold">Supported formats:</p>
                  <p className="text-muted-foreground text-xs">
                    {Object.values(acceptedFormats).flat().join(', ')}
                  </p>
                </div>
              )}
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
