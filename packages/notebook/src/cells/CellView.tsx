import React from 'react';
import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {CellContainer} from './CellContainer';

export const CellView: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.cells.config.data[id]);
  const cellType = cell?.type;
  const registryItem = useStoreWithNotebook((s) =>
    cellType ? s.cells.cellRegistry[cellType] : undefined,
  );

  if (!cell || !registryItem) return null;

  return registryItem.renderCell({
    id,
    cell,
    renderContainer: ({header, content, footer}) => (
      <CellContainer id={id} header={header} footer={footer}>
        {content}
      </CellContainer>
    ),
  });
};
