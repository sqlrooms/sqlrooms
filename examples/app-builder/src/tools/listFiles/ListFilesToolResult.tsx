import {TreeNodeData} from '@sqlrooms/ui';
import {FC} from 'react';
import {FileNodeObject} from '../../components/filetree/fileSystemTreeToNodes';

export const ListFilesToolResult: FC<{
  success: true;
  details: TreeNodeData<FileNodeObject>;
}> = ({}) => {
  return (
    <div className="text-foreground/50 text-xs">Listing project files...</div>
  );
};
