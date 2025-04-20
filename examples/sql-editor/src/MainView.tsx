import {FC} from 'react';
import {SqlEditor} from '@sqlrooms/sql-editor';
import {ThemeSwitch} from '@sqlrooms/ui';
export const MainView: FC = () => {
  return (
    <>
      {/* <ThemeSwitch className="absolute left-[120px] top-1" /> */}
      <SqlEditor isOpen={true} onClose={() => {}} />
    </>
  );
};
