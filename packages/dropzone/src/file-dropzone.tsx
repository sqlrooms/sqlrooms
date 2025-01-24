import {FC, useState} from 'react';
import {useDropzone} from 'react-dropzone';
import {Plus} from 'lucide-react';
import {cn, Spinner} from '@sqlrooms/ui';

export type Props = {
  className?: string;
  isInvalid?: boolean;
  onDrop: (files: File[]) => Promise<void>;
  multiple?: boolean;
  acceptedFormats?: Record<string, string[]>;
  children?: React.ReactNode;
};

export const FileDropzone: FC<Props> = (props) => {
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
        'relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-dashed p-2 transition-colors',
        isDragActive ? 'border-muted bg-muted/50' : 'border-muted',
        isInvalid && 'border-destructive',
        !isAddingDropped && 'hover:border-muted',
        className,
      )}
      {...getRootProps()}
      onClick={isAddingDropped ? undefined : open}
    >
      {isAddingDropped ? (
        <div className="flex h-full w-full items-center justify-center gap-4 text-xs text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">
                  {isDragActive ? 'Drop here ...' : 'Add files'}
                </p>
              </div>
              {acceptedFormats && (
                <div className="flex flex-wrap justify-center gap-2">
                  <p className="text-xs font-bold">Supported formats:</p>
                  <p className="text-xs text-muted-foreground">
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
