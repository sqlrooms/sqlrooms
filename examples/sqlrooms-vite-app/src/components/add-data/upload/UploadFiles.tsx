import {Flex, useToast} from '@chakra-ui/react';
import {getDuckTableSchemas, useDuckDb} from '@sqlrooms/duckdb';
import {FC, useCallback, useContext, useEffect, useState} from 'react';
import {AddDataModalInternalContext} from '../AddDataModalContext';
import FileDropzone from './FileDropzone';
import UploadFilesPreview, {AddedFileInfo} from './UploadFilesPreview';
import {processDroppedFiles} from './processDroppedFiles';
import useProjectStore from '../../../store/DemoProjectStore';

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
  const [addedFiles, setAddedFiles] = useState<AddedFileInfo[]>();
  const {conn, db} = useDuckDb();
  const setTables = useProjectStore((state) => state.setTables);
  const addProjectFile = useProjectStore((state) => state.addProjectFile);
  const toast = useToast();
  useEffect(() => {
    setAddedFiles(undefined);
    // setSelectedFileIndex(0);
  }, [isOpen, conn, toast]);

  const projectFolder = useProjectStore((state) => state.getProjectFolder());

  onConfirmRef.current = useCallback(async () => {
    if (!addedFiles) return;
    for (let i = 0; i < addedFiles.length; i++) {
      const addedFile = addedFiles[i];
      if (!addedFile) continue;
      const {duckdbFileName, file} = addedFile;
      const filePath = `${projectFolder}${addedFile.filePath}`;
      onLoadingStatusChange(`Creating table from file "${filePath}"...`);
      try {
        const desiredTableName = tableNames?.[i];
        await addProjectFile(
          {duckdbFileName, pathname: filePath, file, size: file.size},
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
    for (const {filePath} of addedFiles ?? []) {
      db.dropFile(filePath);
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
    <Flex
      pt="5"
      height="100%"
      width="100%"
      flexDir="column"
      alignItems="stretch"
    >
      <FileDropzone multiple onDrop={handleDropzoneFilesAdded} />
    </Flex>
  );
};

export default UploadFiles;
