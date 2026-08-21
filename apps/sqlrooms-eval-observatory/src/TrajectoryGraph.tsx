import {
  CosmosGraph,
  CosmosGraphControls,
  createCosmosSlice,
  type CosmosSliceState,
  type GraphConfigInterface,
} from '@sqlrooms/cosmos';
import type {
  ObservatoryTrajectory,
  ObservatoryTrajectoryNode,
} from '@sqlrooms/evals/promptfoo/read-model';
import {
  createBaseRoomSlice,
  createRoomStore,
  RoomStateProvider,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {useMemo, useState} from 'react';

type GraphRoomState = BaseRoomStoreState & CosmosSliceState;

function createGraphRoomStore() {
  return createRoomStore<GraphRoomState>((set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createCosmosSlice()(set, get, store),
  })).roomStore;
}

function color(node: ObservatoryTrajectoryNode): readonly number[] {
  if (node.status === 'failed' || node.status === 'error') {
    return [0.89, 0.25, 0.2, 1];
  }
  if (node.kind === 'oracle') return [0.96, 0.66, 0.18, 1];
  if (node.kind === 'nested-agent') return [0.51, 0.34, 0.91, 1];
  if (node.kind === 'tool') return [0.15, 0.65, 0.48, 1];
  if (node.kind === 'model') return [0.2, 0.53, 0.86, 1];
  if (node.kind === 'run') return [0.95, 0.95, 0.9, 1];
  return [0.55, 0.61, 0.57, 1];
}

function graphArrays(trajectory: ObservatoryTrajectory) {
  const indexById = new Map(
    trajectory.nodes.map((node, index) => [node.id, index]),
  );
  const positions: number[] = [];
  const sizes: number[] = [];
  const colors: number[] = [];
  for (const [index, node] of trajectory.nodes.entries()) {
    const sequence = node.sequence ?? index;
    const lane =
      node.kind === 'oracle'
        ? 2
        : node.kind === 'nested-agent'
          ? -1
          : node.kind === 'model'
            ? -2
            : node.kind === 'run'
              ? 0
              : 1;
    positions.push(sequence * 24, lane * 22);
    sizes.push(
      node.kind === 'run'
        ? 9
        : 5 + Math.min(5, Math.log10((node.durationMs ?? 0) + 1)),
    );
    colors.push(...color(node));
  }
  const linkIndexes: number[] = [];
  const linkColors: number[] = [];
  for (const link of trajectory.links) {
    const source = indexById.get(link.sourceId);
    const target = indexById.get(link.targetId);
    if (source === undefined || target === undefined) continue;
    linkIndexes.push(source, target);
    linkColors.push(
      ...(link.kind === 'parent'
        ? [0.67, 0.47, 0.95, 0.8]
        : [0.58, 0.65, 0.6, 0.45]),
    );
  }
  return {
    pointPositions: new Float32Array(positions),
    pointSizes: new Float32Array(sizes),
    pointColors: new Float32Array(colors),
    linkIndexes: new Float32Array(linkIndexes),
    linkColors: new Float32Array(linkColors),
  };
}

export function TrajectoryGraph({
  trajectory,
  selectedNodeId,
  onSelectNode,
}: {
  trajectory: ObservatoryTrajectory;
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
}) {
  const [roomStore] = useState(createGraphRoomStore);
  const arrays = useMemo(() => graphArrays(trajectory), [trajectory]);
  const focusedPointIndex = trajectory.nodes.findIndex(
    (node) => node.id === selectedNodeId,
  );
  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: '#132019',
      enableDrag: true,
      fitViewOnInit: true,
      fitViewDelay: 250,
      linkDefaultArrows: true,
      linkWidth: 1,
      pointSizeScale: 1,
      renderFocusedPointRing: true,
      focusedPointRingColor: '#ffffff',
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#ffffff',
      simulationGravity: 0.15,
      simulationRepulsion: 0.7,
      simulationLinkSpring: 0.8,
      simulationLinkDistance: 14,
      simulationDecay: 500,
      onClick: (index: number | undefined) =>
        onSelectNode(
          index === undefined ? undefined : trajectory.nodes[index]?.id,
        ),
    }),
    [onSelectNode, trajectory.nodes],
  );

  return (
    <RoomStateProvider roomStore={roomStore}>
      <CosmosGraph
        config={config}
        focusedPointIndex={
          focusedPointIndex < 0 ? undefined : focusedPointIndex
        }
        {...arrays}
        renderPointTooltip={(index) => {
          const node = trajectory.nodes[index];
          return node ? `${node.kind}: ${node.label}` : '';
        }}
      >
        <CosmosGraphControls />
      </CosmosGraph>
    </RoomStateProvider>
  );
}
