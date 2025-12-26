'use client';

import React, {useMemo, useState, useEffect} from 'react';
import {VgPlot} from '@/components/VgPlot';
import {
  createMagPlot,
  createDepthPlot,
  createTimePlot,
} from './plotDefinitions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {ScrollArea} from '@/components/ui/scroll-area';

export function Skeleton({h}: {h: number}) {
  return (
    <div
      className="w-full animate-pulse rounded bg-slate-300/30"
      style={{height: h}}
    />
  );
}

export default React.memo(function EarthquakeCharts() {
  const [ready, setReady] = useState(false);

  const magPlot = useMemo(() => createMagPlot(), []);
  const depthPlot = useMemo(() => createDepthPlot(), []);
  const timePlot = useMemo(() => createTimePlot(), []);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#f3efe7] text-slate-800">
      <ScrollArea className="flex-1">
        <div className="p-2">
          <Accordion
            type="multiple"
            defaultValue={['magnitude', 'depth', 'timeline']}
            className="w-full space-y-2"
          >
            <AccordionItem
              value="magnitude"
              className="rounded-sm border border-[#d8d2c7] bg-white/60 px-2"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  Distribution by Magnitude
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex overflow-hidden pb-4">
                {!ready ? <Skeleton h={180} /> : <VgPlot plot={magPlot} />}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="timeline"
              className="rounded-sm border border-[#d8d2c7] bg-white/60 px-2"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  Temporal Frequency
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex overflow-hidden pb-4">
                {!ready ? <Skeleton h={180} /> : <VgPlot plot={timePlot} />}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="depth"
              className="rounded-sm border border-[#d8d2c7] bg-white/60 px-2"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  Depth vs Magnitude
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex overflow-hidden pb-4">
                {!ready ? <Skeleton h={250} /> : <VgPlot plot={depthPlot} />}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
});
