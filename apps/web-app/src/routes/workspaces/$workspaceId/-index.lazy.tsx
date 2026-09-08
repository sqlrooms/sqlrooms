import {getRouteApi} from '@tanstack/react-router';
import {WorkspaceShell} from '#/webapp/WorkspaceShell';

const routeApi = getRouteApi('/workspaces/$workspaceId/');

export function WorkspaceRoute() {
  const {workspaceId} = routeApi.useParams();
  return <WorkspaceShell mode="saved" workspaceId={workspaceId} />;
}
