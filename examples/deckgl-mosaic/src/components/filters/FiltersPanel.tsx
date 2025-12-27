import {VgPlotChart} from '@sqlrooms/mosaic';
import {RoomPanel} from '@sqlrooms/room-shell';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ScrollArea,
  SpinnerPane,
} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {roomStore, useRoomStore} from '../../store';
import {createDepthPlot, createMagPlot, createTimePlot} from './filterPlots';

export default function FiltersPanel({className}: {className?: string}) {
  const mosaicConn = useRoomStore((state) => state.mosaic.connection);
  const isTableReady = useRoomStore((state) =>
    state.db.tables.find((t) => t.tableName === 'earthquakes'),
  );
  if (mosaicConn.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }
  if (!isTableReady || mosaicConn.status !== 'ready') {
    return null;
  }
  return <FiltersPanelContent className={className} />;
}

const FiltersPanelContent = ({className}: {className?: string}) => {
  // Get the brush selection from the store
  const brush = useMemo(() => {
    const state = roomStore.getState();
    // Type assertion needed until package is rebuilt
    return (state.mosaic as any).getSelection('brush');
  }, []);

  const magPlot = useMemo(() => createMagPlot(brush), [brush]);
  const depthPlot = useMemo(() => createDepthPlot(brush), [brush]);
  const timePlot = useMemo(() => createTimePlot(brush), [brush]);

  return (
    <RoomPanel type="filters" showHeader={false} className={className}>
      <div className="flex h-full flex-col">
        <ScrollArea className="flex-1">
          <div className="p-2">
            <Accordion
              type="multiple"
              defaultValue={['magnitude', 'depth', 'timeline']}
              className="w-full space-y-2"
            >
              <AccordionItem
                value="magnitude"
                className="rounded-sm border px-2"
              >
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    Distribution by Magnitude
                  </div>
                </AccordionTrigger>
                <AccordionContent className="flex overflow-hidden pb-4">
                  <VgPlotChart plot={magPlot} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="timeline"
                className="rounded-sm border px-2"
              >
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    Temporal Frequency
                  </div>
                </AccordionTrigger>
                <AccordionContent className="flex overflow-hidden pb-4">
                  <VgPlotChart plot={timePlot} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="depth" className="rounded-sm border px-2">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    Depth vs Magnitude
                  </div>
                </AccordionTrigger>
                <AccordionContent className="flex overflow-hidden pb-4">
                  <VgPlotChart plot={depthPlot} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
      </div>
    </RoomPanel>
  );
};
