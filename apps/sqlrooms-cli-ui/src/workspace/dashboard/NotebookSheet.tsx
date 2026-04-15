import {Notebook} from '@sqlrooms/notebook';
import {useRoomStore} from '../../store';

export const NotebookSheet: React.FC = () => {
  const sheetId = useRoomStore((s) => s.cells.config.currentSheetId);
  return <Notebook sheetId={sheetId} />;
};
