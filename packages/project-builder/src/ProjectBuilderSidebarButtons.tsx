import {getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import React, {FC, useMemo} from 'react';
import {useBaseProjectBuilderStore} from './ProjectBuilderStore';
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
          {Icon ? <Icon className="h-5 w-5" /> : title}
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
  const initialized = useBaseProjectBuilderStore(
    (state) => state.project.initialized,
  );
  const layout = useBaseProjectBuilderStore((state) => state.config.layout);
  const panels = useBaseProjectBuilderStore((state) => state.project.panels);
  const visibleProjectPanels = useMemo(
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );
  const togglePanel = useBaseProjectBuilderStore(
    (state) => state.project.togglePanel,
  );
  const {icon: Icon, title} = panels[projectPanelType] ?? {};

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
  const panels = useBaseProjectBuilderStore((state) => state.project.panels);

  return (
    <div className="flex h-full grow flex-col">
      <div className="flex flex-col gap-2">
        {panels
          ? Object.keys(panels)
              .filter((key) => panels[key]?.placement === 'sidebar')
              .map((type) => (
                <ProjectBuilderSidebarButton
                  key={type}
                  projectPanelType={type}
                />
              ))
          : null}
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        {Object.keys(panels)
          .filter((key) => panels[key]?.placement === 'sidebar-bottom')
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
