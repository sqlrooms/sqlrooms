import {useToast} from '@sqlrooms/ui';
import {FileDropzone} from '@sqlrooms/dropzone';
import {getDuckTableSchemas, useDuckDb} from '@sqlrooms/duckdb';
import {processDroppedFiles, ProjectFileInfo} from '@sqlrooms/project-builder';
import {FC, useCallback, useContext, useEffect, useState} from 'react';
import useProjectStore from '../../../store/DemoProjectStore';
import {AddDataModalInternalContext} from '../AddDataModalContext';
import UploadFilesPreview from './UploadFilesPreview';

const UploadFiles: FC = () => {
  const {
    loadingStatus,
    isOpen,
    onClose,
    onError,
    onShowTabsChange,
    onLoadingStatusChange,
    onCanConfirmChange,
    onCancelRef,
    onConfirmRef,
  } = useContext(AddDataModalInternalContext);
  const [tableNames, setTableNames] = useState<string[]>();
  const [addedFiles, setAddedFiles] = useState<ProjectFileInfo[]>();
  const {conn, db} = useDuckDb();
  const setTables = useProjectStore((state) => state.setTables);
  const addProjectFile = useProjectStore((state) => state.addProjectFile);
  const toast = useToast();

  useEffect(() => {
    setAddedFiles(undefined);
  }, [isOpen, conn, toast]);

  const projectFolder = useProjectStore((state) => state.getProjectFolder());

  onConfirmRef.current = useCallback(async () => {
    if (!addedFiles) return;
    for (let i = 0; i < addedFiles.length; i++) {
      const addedFile = addedFiles[i];
      if (!addedFile) continue;
      const {duckdbFileName, file} = addedFile;
      const filePath = `${projectFolder}${addedFile.pathname}`;
      onLoadingStatusChange(`Creating table from file "${filePath}"...`);
      try {
        const desiredTableName = tableNames?.[i];
        await addProjectFile(
          {duckdbFileName, pathname: filePath, file, size: file?.size},
          desiredTableName,
        );
      } catch (e) {
        onError(`Couldn't create table from file "${name}"`);
        console.error(e);
        return;
      } finally {
        onLoadingStatusChange(undefined);
      }
    }
    try {
      onLoadingStatusChange('Updating table info…');
      setTables(await getDuckTableSchemas());
    } catch (e) {
      onError("Couldn't update table info");
      console.error(e);
    } finally {
      onLoadingStatusChange(undefined);
    }
    onClose();
  }, [
    addedFiles,
    onClose,
    projectFolder,
    onLoadingStatusChange,
    tableNames,
    addProjectFile,
    onError,
    setTables,
  ]);

  const handleDropzoneFilesAdded = useCallback(
    async (droppedFiles: File[]) => {
      await processDroppedFiles(droppedFiles, {
        onError,
        onLoadingStatusChange,
        setTableNames,
        setAddedFiles,
      });
    },
    [db, onError, onLoadingStatusChange, setTableNames, setAddedFiles],
  );

  onCancelRef.current = useCallback(() => {
    if (loadingStatus) return;
    for (const {pathname} of addedFiles ?? []) {
      db.dropFile(pathname);
    }
    onClose();
  }, [addedFiles, db, loadingStatus, onClose]);

  useEffect(() => {
    onShowTabsChange(!addedFiles?.length);
    onCanConfirmChange(!!addedFiles?.length);
  }, [addedFiles, onCanConfirmChange, onShowTabsChange]);

  return addedFiles?.length ? (
    <UploadFilesPreview
      addedFiles={addedFiles}
      tableNames={tableNames}
      onSetAddedFiles={setAddedFiles}
      onSetTableNames={setTableNames}
    />
  ) : (
    <div className="flex flex-col items-stretch h-full w-full pt-5">
      <FileDropzone multiple onDrop={handleDropzoneFilesAdded} />
    </div>
  );
};

export default UploadFiles;
