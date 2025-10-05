import {TreeNodeData} from '@sqlrooms/ui';
import {FC} from 'react';
import {FileNodeObject} from '../../components/filetree/fileSystemTreeToNodes';

export const ListFilesToolResult: FC<{
  success: true;
  details: TreeNodeData<FileNodeObject>;
}> = ({}) => {
  return (
    <div className="border-muted text-fg rounded-md border-gray-200 bg-blue-500/50 p-2 text-sm">
      Listing project files...
    </div>
  );
};
