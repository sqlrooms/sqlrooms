'use client';

import dynamic from 'next/dynamic';

const Room = dynamic(() => import('@/components/room'), {
  ssr: false,
});

const AppShellClient = () => {
  return <Room />;
};

export default AppShellClient;
