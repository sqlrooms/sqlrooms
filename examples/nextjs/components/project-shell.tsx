'use client';

import {projectStore} from '@/app/store';
import {
  ProjectBuilder,
  ProjectBuilderProvider,
} from '@sqlrooms/project-builder';

const ProjectShell = () => {
  if (!projectStore) {
    return null;
  }
  return (
    <div className="absolute inset-0 flex h-[100vh] w-[100vw]">
      <ProjectBuilderProvider projectStore={projectStore}>
        <ProjectBuilder />
      </ProjectBuilderProvider>
    </div>
  );
};

export default ProjectShell;
