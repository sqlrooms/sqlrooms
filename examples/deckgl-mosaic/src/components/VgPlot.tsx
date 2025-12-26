'use client';

import {useEffect, useRef} from 'react';

interface VgPlotProps {
  plot: any;
  style?: React.CSSProperties;
}

export function VgPlot({plot, style}: VgPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !plot) return;

    Promise.resolve(plot).then((element) => {
      container.innerHTML = '';
      if (element) {
        container.appendChild(element);
      }
    });

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [plot]);

  return <div ref={containerRef} style={style} />;
}
