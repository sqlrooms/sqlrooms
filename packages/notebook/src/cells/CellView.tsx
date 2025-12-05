import {useStoreWithNotebook} from '../NotebookSlice';

export const CellView: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.notebook.config.cells[id]);
  const render = useStoreWithNotebook(
    (s) => s.notebook.cellRegistry[cell?.type || '']?.renderComponent,
  );
  if (!cell || !render) return null;
  return render(id);
};
