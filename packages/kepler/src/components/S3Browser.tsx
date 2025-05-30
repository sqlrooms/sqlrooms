import React, {useState, useEffect, useCallback} from 'react';

import {S3FileBrowser, S3CredentialForm, S3State} from '@sqlrooms/s3-browser';
import {S3FileOrDirectory, S3Config, S3Connection} from '@sqlrooms/s3';
import {ChevronLeft} from 'lucide-react';
import {
  DialogFooter,
  Button,
  Spinner,
  Alert,
  AlertDescription,
} from '@sqlrooms/ui';

export type S3BrowserProps = {
  listS3Files: (args: {
    s3Config: S3Config;
    prefix: string;
  }) => Promise<S3FileOrDirectory[]>;
  loadS3Files: (args: {
    s3Config: S3Config;
    prefix: string;
    files: string[];
  }) => Promise<void>;
  s3: S3State['s3'];
  saveS3Connection: (s3Config: S3Config) => Promise<void>;
  loadS3Connections: () => Promise<S3Connection[]>;
  deleteS3Connection: (id: string) => Promise<void>;
};
export const S3Browser = ({
  listS3Files,
  s3,
  loadS3Files,
  saveS3Connection,
  loadS3Connections,
  deleteS3Connection,
}: S3BrowserProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<S3FileOrDirectory[] | null>(null);
  const [selectedDirectory, onChangeSelectedDirectory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const {setCurrentS3Config, clearCurrentS3Config, currentS3Config} = s3;

  const listFiles = useCallback(
    async (s3Config: S3Config, prefix: string) => {
      try {
        const files = await listS3Files({
          s3Config,
          prefix,
        });
        setCurrentS3Config(s3Config);
        console.log('prefix', prefix);
        setFiles(files);
        setError('');
        onChangeSelectedDirectory(prefix);
      } catch (error) {
        setError((error as Error).message);
      }
      setIsConnecting(false);
    },
    [listS3Files, setCurrentS3Config, setFiles, setIsConnecting, setError],
  );
  console.log('selectedDirectory', selectedDirectory);
  const handleLoadFiles = useCallback(async () => {
    await loadS3Files({
      s3Config: currentS3Config,
      prefix: selectedDirectory,
      files: selectedFiles,
    });
  }, [loadS3Files, currentS3Config, selectedFiles, selectedDirectory]);

  // load files when the component mounts
  useEffect(() => {
    if (currentS3Config) {
      listFiles(currentS3Config, '');
    }
  }, []);

  const onSelectDirectory = useCallback(
    (directory: string) => {
      setIsConnecting(true);
      listFiles(currentS3Config, directory);
    },
    [currentS3Config, setIsConnecting, listFiles],
  );

  const onConnect = useCallback(
    (values: S3Config) => {
      setIsConnecting(true);
      listFiles(values, '');
    },
    [listFiles],
  );
  const onBack = useCallback(() => {
    setIsConnecting(false);
    setFiles(null);
    setSelectedFiles([]);
    onChangeSelectedDirectory('');
    clearCurrentS3Config();
  }, [
    setIsConnecting,
    setFiles,
    setSelectedFiles,
    clearCurrentS3Config,
    onChangeSelectedDirectory,
  ]);
  return (
    <div className="flex h-full flex-col items-center gap-4">
      {/* Connection Panel */}
      {!files ? (
        <>
          {error ? (
            <div className="flex w-full justify-center px-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          <S3CredentialForm
            onConnect={onConnect}
            isLoading={isConnecting}
            saveS3Connection={saveS3Connection}
            loadS3Connections={loadS3Connections}
            deleteS3Connection={deleteS3Connection}
          />
        </>
      ) : files.length ? (
        <div className="flex h-full w-full flex-col items-start justify-start gap-2">
          <S3FileBrowser
            files={files}
            isLoading={isConnecting}
            selectedFiles={selectedFiles}
            selectedDirectory={selectedDirectory}
            onChangeSelectedFiles={setSelectedFiles}
            onChangeSelectedDirectory={onSelectDirectory}
            onCanConfirmChange={() => {}}
            renderFileActions={() => (
              <div className="flex w-full items-center justify-between px-2 text-xs">
                <Button
                  variant="link"
                  className="h-6 px-1 py-0"
                  onClick={onBack}
                >
                  <ChevronLeft size={16} />
                  Disconnect
                </Button>
                <div className="flex items-center gap-1">
                  {isConnecting ? (
                    <div className="text-muted-foreground">
                      <Spinner className="h-6 w-6" />
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Connected to</div>
                  )}

                  <b>{currentS3Config.bucket}</b>
                </div>
              </div>
            )}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">No files found</p>
        </div>
      )}

      {/* Footer */}
      <DialogFooter className="mt-6 w-full justify-end">
        {files?.length ? (
          <Button
            disabled={!selectedFiles.length}
            type="submit"
            onClick={handleLoadFiles}
          >
            Add Selected
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
};
