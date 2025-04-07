'use client';

import dynamic from 'next/dynamic';

const ProjectShell = dynamic(() => import('./project-shell'), {
  ssr: false,
});

const HomePage = () => {
  return <ProjectShell />;
};

export default HomePage;
