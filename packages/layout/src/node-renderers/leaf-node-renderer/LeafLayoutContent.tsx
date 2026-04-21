import {FC, PropsWithChildren} from 'react';

export const LeafLayoutContent: FC<PropsWithChildren> = ({children}) => {
  return <div className="h-full w-full overflow-hidden p-2">{children}</div>;
};
