import {FC, PropsWithChildren} from 'react';
import {useIsDockablePanel} from './useIsDockable';

export const LeafLayoutHeader: FC<PropsWithChildren> = ({children}) => {
  const isDockable = useIsDockablePanel();

  if (!isDockable) {
    return null;
  }

  return children;
};
