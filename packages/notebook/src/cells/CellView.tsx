import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {findCellInNotebook} from '../NotebookUtils';

export const CellView: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook(
    (s) => findCellInNotebook(s.notebook.config, id)?.cell,
  );
  const render = useStoreWithNotebook(
    (s) => s.notebook.cellRegistry[cell?.type || '']?.renderComponent,
  );
  if (!cell || !render) return null;
  return render(id);
};
