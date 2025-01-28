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
    <div className={cn('flex flex-col flex-grow gap-3 h-full', className)}>
      {showHeader && <ProjectBuilderPanelHeader panelKey={projectPanelType} />}
      <div className="flex flex-col flex-grow gap-3 h-full overflow-auto">
        {children}
      </div>
    </div>
  );
};

export {ProjectBuilderPanel};
