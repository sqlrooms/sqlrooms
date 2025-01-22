'use client';

import {useProjectStore} from '@/store/demo-project-store';
import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';
import {DatabaseIcon} from 'lucide-react';

export const AppShell = () => {
  const sqlEditor = useDisclosure();
  const addOrUpdateSqlQuery = useProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );
  const sqlEditorConfig = useProjectStore((s) => s.projectConfig.sqlEditor);
  const onChangeSqlEditorConfig = useProjectStore((s) => s.setSqlEditorConfig);

  return (
    <div className="flex w-full h-full">
      <div className="flex flex-col h-full bg-gray-900 pb-2">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          isSelected={false}
          icon={() => <DatabaseIcon size="19px" />}
        />
      </div>
      <div className="flex flex-col w-full h-full bg-gray-800">
        <ProjectBuilder />
      </div>
      {sqlEditor.isOpen ? (
        <SqlEditorModal
          sqlEditorConfig={sqlEditorConfig}
          onChange={onChangeSqlEditorConfig}
          onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
          isOpen={sqlEditor.isOpen}
          onClose={sqlEditor.onClose}
        />
      ) : null}
    </div>
  );
};
