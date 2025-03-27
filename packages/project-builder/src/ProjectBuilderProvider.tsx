import {
  ProjectStateProviderProps,
  ProjectStateProvider,
} from '@sqlrooms/project';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {Toaster, TooltipProvider} from '@sqlrooms/ui';

export function ProjectBuilderProvider<PC extends BaseProjectConfig>({
  children,
  projectStore,
}: ProjectStateProviderProps<PC>) {
  return (
    <ProjectStateProvider projectStore={projectStore}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </ProjectStateProvider>
  );
}
