import {FC} from 'react';
import {SqlEditor} from '@sqlrooms/sql-editor';
import {ThemeSwitch} from '@sqlrooms/ui';

export const MainView: FC = () => {
  return (
    <>
      <SqlEditor isOpen={true} onClose={() => {}} />
      <ThemeSwitch className="absolute right-[170px] top-3" />
    </>
  );
};
