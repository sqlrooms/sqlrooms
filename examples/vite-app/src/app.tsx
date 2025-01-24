import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';

import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {DatabaseIcon} from 'lucide-react';
import useProjectStore from './store/DemoProjectStore';

export const App = () => {
  const sqlEditor = useDisclosure();
  const addOrUpdateSqlQuery = useProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );

  const sqlEditorConfig = useProjectStore((s) => s.projectConfig.sqlEditor);
  const onChangeSqlEditorConfig = useProjectStore((s) => s.setSqlEditorConfig);

  return (
    <div className="flex w-full h-screen">
      <div className="flex flex-col w-[46px] bg-gray-700 items-center pt-10 pb-4 gap-5">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={() => <DatabaseIcon size="19px" />}
        />
        {sqlEditor.isOpen ? (
          <SqlEditorModal
            sqlEditorConfig={sqlEditorConfig}
            onChange={onChangeSqlEditorConfig}
            schema={'main'}
            isOpen={sqlEditor.isOpen}
            onClose={sqlEditor.onClose}
            onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
          />
        ) : null}
      </div>
      <div className="flex flex-col flex-grow">
        <ProjectBuilder />
      </div>
    </div>
  );
};
