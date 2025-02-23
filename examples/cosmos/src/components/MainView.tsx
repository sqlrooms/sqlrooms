import {FC} from 'react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@sqlrooms/ui';
import {PublicationsMap} from './publications-map/PublicationsMap';
import {MammalsGraph} from './mammals-graph/MammalsGraph';

export const MainView: FC = () => {
  return (
    <div className="w-full h-full p-4">
      <Tabs defaultValue="point-map" className="w-full h-full">
        <TabsList>
          <TabsTrigger value="point-map">Publications Map</TabsTrigger>
          <TabsTrigger value="graph">Mammals Graph</TabsTrigger>
        </TabsList>
        <TabsContent
          value="point-map"
          className="w-full h-[calc(100%-40px)] data-[state=inactive]:hidden"
          forceMount
        >
          <PublicationsMap />
        </TabsContent>
        <TabsContent
          value="graph"
          className="w-full h-[calc(100%-40px)] data-[state=inactive]:hidden"
          forceMount
        >
          <MammalsGraph />
        </TabsContent>
      </Tabs>
    </div>
  );
};
