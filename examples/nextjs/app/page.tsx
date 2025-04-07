'use client';

import {SpinnerPane} from '@sqlrooms/ui';
import dynamic from 'next/dynamic';

// Avoid warnings caused by attempts to initialize project store on the server
const ProjectShell = dynamic(() => import('../components/project-shell'), {
  ssr: false,
  loading: () => <SpinnerPane className="h-[100vh] w-[100vw]" />,
});

export default function Home() {
  return <ProjectShell />;
}
