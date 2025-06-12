'use client';

import dynamic from 'next/dynamic';

const RoomShell = dynamic(() => import('./room-shell'), {
  ssr: false,
});

const HomePage = () => {
  return <RoomShell />;
};

export default HomePage;
