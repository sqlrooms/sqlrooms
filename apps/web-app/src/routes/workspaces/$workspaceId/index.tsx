import {createFileRoute} from '@tanstack/react-router';
import {WorkspaceShell} from '#/webapp/WorkspaceShell';

export const Route = createFileRoute('/workspaces/$workspaceId/')({
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const {workspaceId} = Route.useParams();
  return <WorkspaceShell mode="saved" workspaceId={workspaceId} />;
}
