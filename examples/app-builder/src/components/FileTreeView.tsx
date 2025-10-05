import {useRoomStore} from '../store/store';

export const FileTreeView = () => {
  const filesTree = useRoomStore((s) => s.wc.filesTree);
  return <div>FileTreeView</div>;
};
