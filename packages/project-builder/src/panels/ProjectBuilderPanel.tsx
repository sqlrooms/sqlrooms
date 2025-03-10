import {cn} from '@sqlrooms/ui';
import {FC, PropsWithChildren} from 'react';
import {ProjectBuilderPanelHeader} from './ProjectBuilderPanelHeader';

const ProjectBuilderPanel: FC<
  PropsWithChildren<{
    className?: string;
    type: string;
    showHeader?: boolean;
  }>
> = ({type: projectPanelType, children, className, showHeader = true}) => {
  return (
    <div className={cn('flex h-full flex-grow flex-col gap-3', className)}>
      {showHeader && <ProjectBuilderPanelHeader panelKey={projectPanelType} />}
      <div className="flex h-full flex-grow flex-col gap-3 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export {ProjectBuilderPanel};
