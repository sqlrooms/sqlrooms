import {CopyAsTsvButton} from './CopyAsTsvButton';
import {ExportDropdownButton} from './ExportDropdownButton';
import {FC} from 'react';

export const QueryDataTableActionsMenu: FC<{
  query: string;
}> = ({query}) => {
  return (
    <div className="flex items-center gap-1">
      <CopyAsTsvButton query={query} />
      <ExportDropdownButton query={query} />
    </div>
  );
};
