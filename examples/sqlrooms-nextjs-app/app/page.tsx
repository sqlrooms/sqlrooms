'use client';
import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
} from '@sqlrooms/project-builder';

export default function Page() {
  return (
    <div className="flex w-full h-full">
      <div className="flex flex-col h-full bg-gray-900">
        <ProjectBuilderSidebarButtons />
      </div>
      <div className="flex flex-col w-full h-full bg-gray-800">
        <ProjectBuilder />
      </div>
    </div>
  );
}
