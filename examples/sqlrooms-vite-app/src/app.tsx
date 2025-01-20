import {Flex, useDisclosure} from '@chakra-ui/react';
import {
  DocumentationPanel,
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {TbDatabaseSearch} from 'react-icons/tb';
import useProjectStore from './store/DemoProjectStore';

export const App = () => {
  const sqlEditor = useDisclosure();
  const addOrUpdateSqlQuery = useProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );

  const sqlEditorConfig = useProjectStore((s) => s.projectConfig.sqlEditor);
  const onChangeSqlEditorConfig = useProjectStore((s) => s.setSqlEditorConfig);

  return (
    <Flex flex={1} w="100vw" h="100vh">
      {/* <ProjectBuilderTopBar /> */}
      <Flex direction="row" flexGrow="1">
        <Flex
          w="46px"
          bg={'gray.700'}
          alignItems="center"
          flexDir="column"
          pt="10"
          pb="4"
          gap="5"
        >
          <ProjectBuilderSidebarButtons />
          <SidebarButton
            title="SQL Editor"
            onClick={sqlEditor.onToggle}
            isSelected={false}
            icon={() => <TbDatabaseSearch size="19px" />}
          />
          {sqlEditor.isOpen ? (
            <SqlEditorModal
              sqlEditorConfig={sqlEditorConfig}
              onChange={onChangeSqlEditorConfig}
              schema={'main'}
              isOpen={sqlEditor.isOpen}
              onClose={sqlEditor.onClose}
              documentationPanel={
                <Flex flexDir="column" height="100%">
                  <DocumentationPanel
                    showHeader={false}
                    pageUrl={`https://duckdb.org/docs/sql/introduction`}
                  />
                </Flex>
              }
              onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
            />
          ) : null}
        </Flex>
        <Flex direction="column" alignItems="stretch" flexGrow={1} gap={0}>
          <ProjectBuilder />
          {/* {initialized && !isReadOnly ? (
            <BeforeUnloadPrompt
              hasUnsavedChanges={hasUnsavedChanges}
              message="You have unsaved changes. Are you sure you want to leave?"
            />
          ) : null} */}
        </Flex>
      </Flex>
    </Flex>
  );
};
