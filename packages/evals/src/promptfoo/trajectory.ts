import type {JsonObject, JsonValue} from '../json';
import type {ObservatoryRun} from './readModel';

/** Semantic node in a runner-independent observatory trajectory. */
export type ObservatoryTrajectoryNode = {
  id: string;
  kind:
    | 'run'
    | 'oracle'
    | 'model'
    | 'tool'
    | 'nested-agent'
    | 'approval'
    | 'error'
    | 'mutation';
  label: string;
  status?: string;
  sequence?: number;
  timestamp?: string;
  durationMs?: number;
  data: JsonObject;
  relatedOracleIds: string[];
};

/** Semantic relationship in a runner-independent observatory trajectory. */
export type ObservatoryTrajectoryLink = {
  sourceId: string;
  targetId: string;
  kind: 'contains' | 'order' | 'parent' | 'assertion';
};

/** Trajectory view derived only from normalized SQLRooms run evidence. */
export type ObservatoryTrajectory = {
  runId: string;
  nodes: ObservatoryTrajectoryNode[];
  links: ObservatoryTrajectoryLink[];
  graphRecommended: boolean;
  recommendationReason: string;
};

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function oracleIds(data: JsonObject): string[] {
  const one = stringValue(data.oracleId);
  const many = Array.isArray(data.oracleIds)
    ? data.oracleIds.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  return [...new Set([...(one ? [one] : []), ...many])];
}

/**
 * Builds an optional trajectory graph from the normalized run model.
 *
 * Promptfoo spans are intentionally excluded. Parent links are emitted only
 * when SQLRooms evidence carries explicit tool-call identities.
 */
export function createObservatoryTrajectory(
  run: ObservatoryRun,
): ObservatoryTrajectory {
  const runNodeId = `${run.id}:run`;
  const orderedEvents = [...run.events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const nodes: ObservatoryTrajectoryNode[] = [
    {
      id: runNodeId,
      kind: 'run',
      label: run.scenario.id,
      status: run.status,
      data: {
        scenarioVersion: run.scenario.version ?? null,
        repetition: run.scenario.repetition ?? null,
      },
      relatedOracleIds: run.oracleResults.map((result) => result.oracleId),
    },
  ];
  const links: ObservatoryTrajectoryLink[] = [];
  const nodeIdByToolCall = new Map<string, string>();

  for (const event of orderedEvents) {
    const id = `${run.id}:event:${event.sequence}`;
    const toolCallId = stringValue(event.data.toolCallId);
    if (toolCallId) nodeIdByToolCall.set(toolCallId, id);
    nodes.push({
      id,
      kind: event.type,
      label: event.name ?? event.type,
      status:
        stringValue(event.data.state) ??
        (event.type === 'error' || stringValue(event.data.errorText)
          ? 'error'
          : undefined),
      sequence: event.sequence,
      timestamp: event.timestamp,
      durationMs: numberValue(event.data.durationMs),
      data: event.data,
      relatedOracleIds: oracleIds(event.data),
    });
  }

  const eventNodes = nodes.filter(
    (node): node is ObservatoryTrajectoryNode & {sequence: number} =>
      node.sequence !== undefined,
  );
  if (eventNodes[0]) {
    links.push({
      sourceId: runNodeId,
      targetId: eventNodes[0].id,
      kind: 'contains',
    });
  }
  for (let index = 1; index < eventNodes.length; index += 1) {
    links.push({
      sourceId: eventNodes[index - 1]!.id,
      targetId: eventNodes[index]!.id,
      kind: 'order',
    });
  }
  for (const node of eventNodes) {
    const parentToolCallId = stringValue(node.data.parentToolCallId);
    const parentId = parentToolCallId
      ? nodeIdByToolCall.get(parentToolCallId)
      : undefined;
    if (parentId) {
      links.push({sourceId: parentId, targetId: node.id, kind: 'parent'});
    }
  }

  for (const result of run.oracleResults) {
    const id = `${run.id}:oracle:${result.oracleId}`;
    nodes.push({
      id,
      kind: 'oracle',
      label: result.oracleId,
      status: result.pass ? 'passed' : 'failed',
      data: {
        reason: result.reason,
        score: result.score,
        evidence: result.evidence,
        metadata: result.metadata,
      },
      relatedOracleIds: [result.oracleId],
    });
    links.push({sourceId: runNodeId, targetId: id, kind: 'assertion'});
  }

  const nestedCount = eventNodes.filter(
    (node) => node.kind === 'nested-agent',
  ).length;
  const parentCount = links.filter((link) => link.kind === 'parent').length;
  const graphRecommended = nestedCount > 0 || parentCount > 0;
  return {
    runId: run.id,
    nodes,
    links,
    graphRecommended,
    recommendationReason: graphRecommended
      ? `${nestedCount} nested-agent event(s) and ${parentCount} explicit parent link(s) make delegation difficult to read linearly.`
      : 'No nested or delegated trajectory is present; the ordered event list is clearer.',
  };
}
