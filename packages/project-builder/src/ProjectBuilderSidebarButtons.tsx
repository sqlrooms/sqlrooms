import {getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {FC, useMemo} from 'react';
import {useBaseProjectStore} from './ProjectStateProvider';

const SidebarButton: FC<{
  title: string;
  isSelected: boolean;
  isDisabled?: boolean;
  icon: React.ComponentType<{className?: string}>;
  onClick: () => void;
}> = ({title, isSelected, isDisabled = false, icon: Icon, onClick}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-none',
            isSelected ? 'bg-secondary' : 'hover:bg-secondary/50',
            // isDisabled && 'opacity-50 cursor-not-allowed',
          )}
          disabled={isDisabled}
          onClick={onClick}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const ProjectBuilderSidebarButton: FC<{projectPanelType: string}> = ({
  projectPanelType,
}) => {
  const initialized = useBaseProjectStore((state) => state.initialized);
  const layout = useBaseProjectStore((state) => state.projectConfig.layout);
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  const visibleProjectPanels = useMemo(
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );
  const togglePanel = useBaseProjectStore((state) => state.togglePanel);
  const {icon: Icon, title} = projectPanels[projectPanelType] ?? {};

  return (
    <SidebarButton
      key={projectPanelType}
      title={title ?? ''}
      isSelected={visibleProjectPanels.includes(projectPanelType)}
      isDisabled={!initialized}
      icon={Icon ?? (() => null)}
      onClick={() => togglePanel(projectPanelType)}
    />
  );
};

const ProjectBuilderSidebarButtons: FC = () => {
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);

  return (
    <div className="flex flex-col h-full grow">
      <div className="flex flex-col gap-2">
        {Object.keys(projectPanels)
          .filter((key) => projectPanels[key]?.placement === 'sidebar')
          .map((type) => (
            <ProjectBuilderSidebarButton key={type} projectPanelType={type} />
          ))}
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        {Object.keys(projectPanels)
          .filter((key) => projectPanels[key]?.placement === 'sidebar-bottom')
          .map((type) => (
            <ProjectBuilderSidebarButton key={type} projectPanelType={type} />
          ))}
      </div>
    </div>
  );
};

export {
  ProjectBuilderSidebarButton,
  ProjectBuilderSidebarButtons,
  SidebarButton,
};
