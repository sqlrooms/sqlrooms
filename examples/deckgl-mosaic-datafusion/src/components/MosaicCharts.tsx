import {useEffect, useRef, type ReactNode} from 'react';
import type {
  Coordinator,
  MosaicClient,
  Selection,
  SelectionClause,
} from '@uwdata/mosaic-core';
import * as vg from '@uwdata/vgplot';

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="chart-card">
      <div className="pane-head">
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

export function ChartSpinner() {
  return (
    <div className="chart-host">
      <div className="chart-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading data
      </div>
    </div>
  );
}

/**
 * Charts are sized to fill their host card; the sidebar distributes the
 * remaining height across the four cards. The fallbacks cover layouts
 * where the host has no intrinsic height, such as the stacked mobile panel.
 */
function hostSize(host: HTMLElement, fallbackHeight: number) {
  const styles = getComputedStyle(host);
  const width =
    host.clientWidth -
    parseFloat(styles.paddingLeft) -
    parseFloat(styles.paddingRight);
  const height =
    host.clientHeight -
    parseFloat(styles.paddingTop) -
    parseFloat(styles.paddingBottom);
  return {
    width: width > 80 ? width : 490,
    height: height > 80 ? height : fallbackHeight,
  };
}

function sizeKey(hosts: HTMLElement[]) {
  return hosts
    .map((host) => `${host.clientWidth}x${host.clientHeight}`)
    .join('|');
}

type Hosts = {
  gradient: HTMLElement;
  distribution: HTMLElement;
  area: HTMLElement;
  classes: HTMLElement;
};

type ChartInteractor = {
  value: unknown;
  clause: (value: unknown) => SelectionClause;
};

/**
 * The brush and toggle interactors of the rendered plots, in host order.
 * buildCharts is deterministic, so positions line up across rebuilds.
 */
function chartInteractors(hosts: Hosts) {
  return Object.values(hosts).flatMap((host) =>
    Array.from(host.children).flatMap(
      (child) =>
        (child as unknown as {value?: {interactors?: ChartInteractor[]}}).value
          ?.interactors ?? [],
    ),
  );
}

/**
 * Mosaic keys selection clauses by source object identity, so rebuilding
 * the plots would orphan clauses published by the destroyed interactors:
 * the brush visuals vanish while the stale predicates keep filtering and
 * can never be replaced by new brushes. Instead, clauses are carried over:
 * each one is re-published from the equivalent new interactor, whose seeded
 * value also makes the brush rectangle render at the same spot.
 */
function migrateClauses(
  selection: Selection,
  previous: ChartInteractor[],
  next: ChartInteractor[],
) {
  for (const clause of [...selection.clauses]) {
    const interactor = next[previous.indexOf(clause.source as ChartInteractor)];
    if (!interactor) continue;
    interactor.value = clause.value;
    selection.update({...clause, value: null, predicate: null});
    selection.update(interactor.clause(clause.value));
  }
}

function clearOwnedClauses(
  selection: Selection,
  interactors: ChartInteractor[],
) {
  const owned = new Set(interactors);
  for (const clause of [...selection.clauses]) {
    if (!owned.has(clause.source as ChartInteractor)) continue;
    selection.update({...clause, value: null, predicate: null});
  }
}

function buildCharts(
  hosts: Hosts,
  coordinator: Coordinator,
  selection: Selection,
  streaming: boolean,
) {
  const ctx = vg.createAPIContext({coordinator});
  const plot = ctx.plot.bind(ctx);
  const allCells = ctx.from('cells_current_lead');
  const selectedCells = ctx.from('cells_current_lead', {filterBy: selection});
  const brush = {fill: 'none', stroke: '#22342c', 'stroke-width': 1.4};
  /**
   * Fixed freezes a domain on whatever data the first render sees. While
   * Zarr chunks are still streaming that clips later bars outside the axes,
   * so domains stay auto until the final rebuild on stream completion.
   */
  const fixedDomains = streaming
    ? []
    : [ctx.xDomain(ctx.Fixed), ctx.yDomain(ctx.Fixed)];
  const fixedXDomain = streaming ? [] : [ctx.xDomain(ctx.Fixed)];
  const gradientSize = hostSize(hosts.gradient, 140);
  const distributionSize = hostSize(hosts.distribution, 140);
  const areaSize = hostSize(hosts.area, 140);
  const classesSize = hostSize(hosts.classes, 120);

  hosts.distribution.replaceChildren(
    plot(
      ctx.rectY(allCells, {
        x: ctx.bin('value', {steps: 16}),
        y: ctx.count(),
        fill: '#d8e0db',
        fillOpacity: 0.45,
        inset: 1,
      }),
      ctx.rectY(selectedCells, {
        x: ctx.bin('value', {steps: 16}),
        y: ctx.count(),
        fill: '#e87d5b',
        inset: 1,
      }),
      ctx.intervalX({as: selection, field: 'value', brush}),
      ...fixedDomains,
      ctx.xLabel('2 m temp (°C)'),
      ctx.yLabel('cells'),
      ctx.width(distributionSize.width),
      ctx.height(distributionSize.height),
      ctx.marginLeft(48),
      ctx.marginRight(16),
    ),
  );

  hosts.area.replaceChildren(
    plot(
      ctx.rectY(allCells, {
        x: ctx.bin('value', {steps: 16}),
        y: ctx.sum('area_km2'),
        fill: '#d8e0db',
        fillOpacity: 0.45,
        inset: 1,
      }),
      ctx.rectY(selectedCells, {
        x: ctx.bin('value', {steps: 16}),
        y: ctx.sum('area_km2'),
        fill: '#e87d5b',
        inset: 1,
      }),
      ctx.intervalX({as: selection, field: 'value', brush}),
      ...fixedDomains,
      ctx.xLabel('2 m temp (°C)'),
      ctx.yLabel('area (km²)'),
      ctx.width(areaSize.width),
      ctx.height(areaSize.height),
      ctx.marginLeft(56),
      ctx.marginRight(16),
    ),
  );

  hosts.classes.replaceChildren(
    plot(
      ctx.barX(allCells, {
        x: ctx.count(),
        y: 'category',
        fill: '#d8e0db',
        fillOpacity: 0.48,
      }),
      ctx.barX(selectedCells, {
        x: ctx.count(),
        y: 'category',
        fill: 'category',
      }),
      ctx.barX(allCells, {
        x: ctx.count(),
        y: 'category',
        fill: '#000',
        fillOpacity: 0.001,
      }),
      ctx.toggleY({as: selection, peers: false}),
      ...fixedXDomain,
      ctx.yDomain(['freezing', 'cool', 'mild', 'warm']),
      ctx.colorDomain(['freezing', 'cool', 'mild', 'warm']),
      ctx.colorRange(['#3f3c97', '#2f7d88', '#e87d5b', '#e7ba52']),
      ctx.xLabel('cells'),
      ctx.yLabel(null),
      ctx.width(classesSize.width),
      ctx.height(classesSize.height),
      ctx.marginLeft(72),
      ctx.marginRight(16),
    ),
  );

  hosts.gradient.replaceChildren(
    plot(
      ctx.lineY(allCells, {
        x: 'lat',
        y: ctx.avg('value'),
        stroke: '#2f7d88',
        strokeWidth: 2.2,
        curve: 'monotone-x',
      }),
      ctx.dot(selectedCells, {
        x: 'lat',
        y: 'value',
        fill: '#e87d5b',
        fillOpacity: 0.45,
        r: 2.2,
      }),
      ctx.intervalX({as: selection, field: 'lat', brush}),
      ...fixedDomains,
      ctx.xLabel('latitude (°N)'),
      ctx.yLabel('2 m temp (°C)'),
      ctx.width(gradientSize.width),
      ctx.height(gradientSize.height),
      ctx.marginLeft(48),
      ctx.marginRight(16),
    ),
  );
}

/**
 * The four crossfiltered vgplot charts. vgplot owns the host DOM, so the
 * refs have no React children. Charts rebuild at the new size when the
 * sidebar cards change on window resize or zoom; the shared Selection and
 * any active brushes survive the rebuild. While streaming is true, domains
 * rescale with each
 * arriving Zarr chunk; the flip to false rebuilds once with Fixed domains
 * over the full dataset.
 */
export function MosaicCharts({
  coordinator,
  selection,
  streaming = false,
}: {
  coordinator: Coordinator;
  selection: Selection;
  streaming?: boolean;
}) {
  const distributionRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const classesRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);
  const interactorsRef = useRef<ChartInteractor[]>([]);

  useEffect(() => {
    const hosts: Hosts = {
      gradient: gradientRef.current!,
      distribution: distributionRef.current!,
      area: areaRef.current!,
      classes: classesRef.current!,
    };
    const hostList = Object.values(hosts);
    let renderedKey = sizeKey(hostList);
    let ownedClients: MosaicClient[] = [];

    const disconnectOwnedClients = () => {
      for (const client of ownedClients) coordinator.disconnect(client);
      ownedClients = [];
    };

    const build = () => {
      const previous = interactorsRef.current;
      disconnectOwnedClients();
      const before = new Set(coordinator.clients);
      buildCharts(hosts, coordinator, selection, streaming);
      ownedClients = Array.from(coordinator.clients).filter(
        (client) => !before.has(client),
      );
      const next = chartInteractors(hosts);
      migrateClauses(selection, previous, next);
      interactorsRef.current = next;
    };
    build();

    let resizeTimer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const key = sizeKey(hostList);
        if (
          key === renderedKey ||
          hostList.some((host) => host.clientHeight === 0)
        )
          return;
        renderedKey = key;
        build();
      }, 150);
    });
    hostList.forEach((host) => observer.observe(host));

    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
      disconnectOwnedClients();
      hostList.forEach((host) => host.replaceChildren());
    };
  }, [coordinator, selection, streaming]);

  useEffect(
    () => () => {
      clearOwnedClauses(selection, interactorsRef.current);
      interactorsRef.current = [];
    },
    [selection],
  );

  return (
    <>
      <ChartCard title="Temperature Distribution">
        <div className="chart-host" ref={distributionRef} />
      </ChartCard>
      <ChartCard title="Area by Temperature">
        <div className="chart-host" ref={areaRef} />
      </ChartCard>
      <ChartCard title="Temperature Classes">
        <div className="chart-host" ref={classesRef} />
      </ChartCard>
      <ChartCard title="Latitudinal Gradient">
        <div className="chart-host" ref={gradientRef} />
      </ChartCard>
    </>
  );
}
