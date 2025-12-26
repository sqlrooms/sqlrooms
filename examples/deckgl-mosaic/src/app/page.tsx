'use client';

import EarthquakeMap from '@/components/map/EarthquakeMap';

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <EarthquakeMap />
    </main>
  );
}
