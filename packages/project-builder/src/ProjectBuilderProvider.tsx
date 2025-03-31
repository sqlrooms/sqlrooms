import {
  ProjectStateProviderProps,
  ProjectStateProvider,
} from '@sqlrooms/project';
import {Toaster, TooltipProvider} from '@sqlrooms/ui';
import {BaseProjectConfig} from '@sqlrooms/project-config/src/BaseProjectConfig';

/**
 * Provider for the project builder.
 * @param props - The props for the provider.
 * @returns The provider for the project builder.
 */
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
