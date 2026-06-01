import {createFileRoute} from '@tanstack/react-router';
import {WorkspaceShell} from '#/webapp/WorkspaceShell';

export const Route = createFileRoute('/')({
  component: IndexRoute,
});

function IndexRoute() {
  return <WorkspaceShell mode="unsaved" />;
}
