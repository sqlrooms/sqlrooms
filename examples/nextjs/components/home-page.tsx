'use client';

import dynamic from 'next/dynamic';

const AppShell = dynamic(() => import('./app-shell'), {
  ssr: false,
});

const HomePage = () => {
  return <AppShell />;
};

export default HomePage;
