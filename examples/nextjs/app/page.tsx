'use client';

import {SpinnerPane} from '@sqlrooms/ui';
import dynamic from 'next/dynamic';

// Avoid warnings caused by attempts to initialize room store on the server
const AppShell = dynamic(() => import('../components/app-shell'), {
  ssr: false,
  loading: () => <SpinnerPane className="h-[100vh] w-[100vw]" />,
});

export default function Home() {
  return <AppShell />;
}
