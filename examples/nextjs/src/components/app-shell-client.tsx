'use client';

import dynamic from 'next/dynamic';
import {FC} from 'react';

const Room = dynamic(() => import('@/components/room'), {
  ssr: false,
});

const AppShellClient: FC = () => {
  return <Room />;
};

export default AppShellClient;
