import {FC} from 'react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {PointMap} from './PointMap';
import {MammalsGraph} from './MammalsGraph';

export const MainView: FC = () => {
  return (
    <div className="w-full h-full p-4">
      <Tabs defaultValue="graph" className="w-full h-full">
        <TabsList>
          <TabsTrigger value="graph">Mammals Graph</TabsTrigger>
          <TabsTrigger value="point-map">Publications Point Map</TabsTrigger>
        </TabsList>
        <TabsContent
          value="graph"
          className="w-full h-[calc(100%-40px)] data-[state=inactive]:hidden"
          forceMount
        >
          <MammalsGraph />
        </TabsContent>
        <TabsContent
          value="point-map"
          className="w-full h-[calc(100%-40px)] data-[state=inactive]:hidden"
          forceMount
        >
          <PointMap />
        </TabsContent>
      </Tabs>
    </div>
  );
};
