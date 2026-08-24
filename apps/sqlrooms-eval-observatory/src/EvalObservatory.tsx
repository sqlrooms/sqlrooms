import {
  ObservatoryExportSchema,
  compareObservatoryRuns,
  createObservatoryTrajectory,
  filterObservatoryRuns,
  findAutomaticBaseline,
  summarizeObservatoryRuns,
  type ObservatoryRun,
  type ObservatoryRunFilters,
  type ObservatoryTrajectory,
  type ObservatoryTrajectoryNode,
} from '@sqlrooms/evals/promptfoo/read-model';
import {lazy, Suspense, useMemo, useState} from 'react';

const TrajectoryGraph = lazy(() =>
  import('./TrajectoryGraph').then((module) => ({
    default: module.TrajectoryGraph,
  })),
);

type GroupKey =
  | 'none'
  | 'scenario'
  | 'profile'
  | 'commit'
  | 'model'
  | 'status'
  | 'date';

function distinct(
  runs: readonly ObservatoryRun[],
  select: (run: ObservatoryRun) => string | undefined,
) {
  return [
    ...new Set(
      runs.map(select).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
}

function groupValue(run: ObservatoryRun, key: GroupKey): string {
  if (key === 'scenario') return run.scenario.id;
  if (key === 'profile') return run.profile.name;
  if (key === 'commit') return run.repository.commitSha ?? 'unknown';
  if (key === 'model') return run.model.modelId;
  if (key === 'status') return run.status;
  if (key === 'date') return run.createdAt.slice(0, 10);
  return 'All runs';
}

function formatNumber(value: number | undefined, suffix = '') {
  return value === undefined
    ? '—'
    : `${Math.round(value).toLocaleString()}${suffix}`;
}

function Json({value}: {value: unknown}) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function baselineIdAfterRunSelection(
  baselineId: string | undefined,
  selectedRunId: string,
): string | undefined {
  return baselineId === selectedRunId ? undefined : baselineId;
}

export function EvalObservatory() {
  const [runs, setRuns] = useState<ObservatoryRun[]>([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ObservatoryRunFilters>({});
  const [groupBy, setGroupBy] = useState<GroupKey>('scenario');
  const [selectedId, setSelectedId] = useState<string>();
  const [baselineId, setBaselineId] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const filtered = useMemo(
    () => filterObservatoryRuns(runs, filters),
    [runs, filters],
  );
  const summary = useMemo(() => summarizeObservatoryRuns(filtered), [filtered]);
  const selected = runs.find((run) => run.id === selectedId);
  const defaultBaseline = selected
    ? findAutomaticBaseline(runs, selected)
    : undefined;
  const baseline = runs.find((run) => run.id === baselineId) ?? defaultBaseline;
  const selectedTrajectory = useMemo(
    () => (selected ? createObservatoryTrajectory(selected) : undefined),
    [selected],
  );
  const baselineTrajectory = useMemo(
    () => (baseline ? createObservatoryTrajectory(baseline) : undefined),
    [baseline],
  );
  const selectedTrajectoryNodeMatch = findTrajectoryNode(
    selectedNodeId,
    selectedTrajectory,
    baselineTrajectory,
  );
  const selectedTrajectoryNode = selectedTrajectoryNodeMatch?.node;
  const selectedTrajectoryNodeOwner = findTrajectoryNodeOwner(
    selectedTrajectoryNodeMatch,
    selectedTrajectory,
    selected,
    baseline,
  );
  const grouped = useMemo(() => {
    const result = new Map<string, ObservatoryRun[]>();
    for (const run of filtered) {
      const key = groupValue(run, groupBy);
      result.set(key, [...(result.get(key) ?? []), run]);
    }
    return [...result.entries()];
  }, [filtered, groupBy]);

  async function load(files: FileList | null) {
    setError('');
    try {
      const loaded: ObservatoryRun[] = [];
      for (const file of Array.from(files ?? [])) {
        const parsed = ObservatoryExportSchema.parse(
          JSON.parse(await file.text()),
        );
        loaded.push(...parsed.runs);
      }
      setRuns((current) => {
        const byId = new Map(current.map((run) => [run.id, run]));
        for (const run of loaded) byId.set(run.id, run);
        return [...byId.values()].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      });
      setSelectedId((current) => current ?? loaded[0]?.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">SQLRooms / behavioral evals</p>
          <h1>Run Observatory</h1>
          <p className="lede">
            Find the contract that regressed, then inspect its exact trajectory
            and durable state.
          </p>
        </div>
        <label className="load">
          Load retained summaries
          <input
            type="file"
            accept="application/json,.json"
            multiple
            onChange={(event) => void load(event.target.files)}
          />
        </label>
      </header>

      {error && <div className="error">Unsupported summary: {error}</div>}
      {runs.length === 0 && (
        <section className="empty">
          <h2>No retained runs loaded</h2>
          <p>
            Export a Promptfoo database with <code>pnpm evals:export</code>,
            then load the generated summary JSON here. The browser never writes
            to the source database.
          </p>
        </section>
      )}

      {runs.length > 0 && (
        <>
          <section className="metrics">
            <article>
              <span>Pass rate</span>
              <strong>{(summary.passRate * 100).toFixed(1)}%</strong>
            </article>
            <article>
              <span>Runs</span>
              <strong>{summary.runCount}</strong>
            </article>
            <article>
              <span>Mean latency</span>
              <strong>{formatNumber(summary.meanLatencyMs, ' ms')}</strong>
            </article>
            <article>
              <span>Tokens</span>
              <strong>{formatNumber(summary.totalTokens)}</strong>
            </article>
            <article>
              <span>Tools / nested</span>
              <strong>
                {summary.toolCount} / {summary.nestedAgentCount}
              </strong>
            </article>
            <article>
              <span>Errors</span>
              <strong>{summary.errorCount}</strong>
            </article>
          </section>

          <section className="controls">
            <Filter
              label="Scenario"
              value={filters.scenario}
              values={distinct(runs, (run) => run.scenario.id)}
              onChange={(scenario) => setFilters({...filters, scenario})}
            />
            <Filter
              label="Profile"
              value={filters.profile}
              values={distinct(runs, (run) => run.profile.name)}
              onChange={(profile) => setFilters({...filters, profile})}
            />
            <Filter
              label="Commit"
              value={filters.commit}
              values={distinct(runs, (run) => run.repository.commitSha)}
              onChange={(commit) => setFilters({...filters, commit})}
            />
            <Filter
              label="Model"
              value={filters.model}
              values={distinct(runs, (run) => run.model.modelId)}
              onChange={(model) => setFilters({...filters, model})}
            />
            <Filter
              label="Status"
              value={filters.status}
              values={['passed', 'failed', 'error', 'cancelled', 'unknown']}
              onChange={(status) =>
                setFilters({
                  ...filters,
                  status: status as ObservatoryRun['status'] | undefined,
                })
              }
            />
            <label>
              From
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    from: event.target.value || undefined,
                  })
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(event) =>
                  setFilters({...filters, to: event.target.value || undefined})
                }
              />
            </label>
            <label>
              Group by
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as GroupKey)}
              >
                {[
                  'scenario',
                  'profile',
                  'commit',
                  'model',
                  'status',
                  'date',
                  'none',
                ].map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="runs">
            {grouped.map(([group, groupRuns]) => (
              <div key={group} className="run-group">
                <h2>
                  {group}{' '}
                  <small>
                    {groupRuns.length} runs ·{' '}
                    {(
                      summarizeObservatoryRuns(groupRuns).passRate * 100
                    ).toFixed(0)}
                    % pass
                  </small>
                </h2>
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Scenario</th>
                      <th>Commit</th>
                      <th>Model</th>
                      <th>Date</th>
                      <th>Latency</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                      <th>Tools</th>
                      <th>Nested</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRuns.map((run) => (
                      <tr
                        key={run.id}
                        className={selectedId === run.id ? 'selected' : ''}
                      >
                        <td>
                          <span className={`status ${run.status}`}>
                            {run.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="run-select"
                            aria-pressed={selectedId === run.id}
                            onClick={() => {
                              setSelectedId(run.id);
                              setBaselineId((current) =>
                                baselineIdAfterRunSelection(current, run.id),
                              );
                              setSelectedNodeId(undefined);
                            }}
                          >
                            {run.scenario.id}@{run.scenario.version ?? '?'}
                          </button>
                        </td>
                        <td>{run.repository.commitSha?.slice(0, 8) ?? '—'}</td>
                        <td>{run.model.modelId}</td>
                        <td>{new Date(run.createdAt).toLocaleString()}</td>
                        <td>{formatNumber(run.latencyMs, ' ms')}</td>
                        <td>{formatNumber(run.usage?.totalTokens)}</td>
                        <td>
                          {run.usage?.costUsd === undefined
                            ? '—'
                            : `$${run.usage.costUsd.toFixed(4)}`}
                        </td>
                        <td>{run.counts.tools}</td>
                        <td>{run.counts.nestedAgents}</td>
                        <td>{run.counts.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          {selected && (
            <section className="detail">
              <div className="detail-title">
                <div>
                  <p className="eyebrow">Selected run</p>
                  <h2>{selected.scenario.id}</h2>
                </div>
                <label>
                  Compare with
                  <select
                    value={baseline?.id ?? ''}
                    onChange={(event) => {
                      setBaselineId(event.target.value || undefined);
                      setSelectedNodeId(undefined);
                    }}
                  >
                    <option value="">Last known good</option>
                    {runs
                      .filter((run) => run.id !== selected.id)
                      .map((run) => (
                        <option value={run.id} key={run.id}>
                          {run.scenario.id} · {run.status} · {run.createdAt}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {baseline && (
                <Json value={compareObservatoryRuns(selected, baseline)} />
              )}
              {selectedTrajectory && (
                <TrajectoryComparison
                  selected={selectedTrajectory}
                  baseline={baselineTrajectory}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              )}
              {selectedTrajectoryNode && selectedTrajectoryNodeOwner && (
                <section className="trajectory-node-detail">
                  <p className="eyebrow">
                    {selectedTrajectoryNodeOwner.label} trajectory item
                  </p>
                  <h3>
                    {selectedTrajectoryNode.kind}:{' '}
                    {selectedTrajectoryNode.label}
                  </h3>
                  <Json
                    value={{
                      status: selectedTrajectoryNode.status,
                      durationMs: selectedTrajectoryNode.durationMs,
                      timestamp: selectedTrajectoryNode.timestamp,
                      input: selectedTrajectoryNode.data.input,
                      output: selectedTrajectoryNode.data.output,
                      error:
                        selectedTrajectoryNode.data.errorText ??
                        selectedTrajectoryNode.data.message,
                      relatedOracleEvidence: relatedOracles(
                        selectedTrajectoryNode,
                        selectedTrajectoryNodeOwner.run,
                      ),
                      raw: selectedTrajectoryNode.data,
                    }}
                  />
                </section>
              )}
              <div className="detail-grid">
                <Detail title="Prompt turns">
                  <Json value={selected.promptTurns} />
                </Detail>
                <Detail title="Final answer">
                  <p className="answer">{selected.answer}</p>
                </Detail>
                <Detail title="Oracle results">
                  <Json value={selected.oracleResults} />
                </Detail>
                <Detail title="Grader feedback">
                  <Json value={selected.graderFeedback ?? null} />
                </Detail>
                <Detail title="Ordered events">
                  <EventList
                    trajectory={selectedTrajectory}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                </Detail>
                <Detail title="Promptfoo spans">
                  <Json value={selected.spans} />
                </Detail>
                <Detail title="Final durable state">
                  <Json value={selected.finalState ?? null} />
                </Detail>
                <Detail title="Unknown metadata">
                  <Json value={selected.unknownMetadata} />
                </Detail>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export function findTrajectoryNode(
  nodeId: string | undefined,
  ...trajectories: Array<ObservatoryTrajectory | undefined>
):
  | {
      node: ObservatoryTrajectoryNode;
      trajectory: ObservatoryTrajectory;
    }
  | undefined {
  if (!nodeId) return undefined;
  for (const trajectory of trajectories) {
    const node = trajectory?.nodes.find((candidate) => candidate.id === nodeId);
    if (trajectory && node) return {node, trajectory};
  }
  return undefined;
}

export function findTrajectoryNodeOwner(
  match: ReturnType<typeof findTrajectoryNode>,
  selectedTrajectory: ObservatoryTrajectory | undefined,
  selected: ObservatoryRun | undefined,
  baseline: ObservatoryRun | undefined,
):
  | {label: 'Selected'; run: ObservatoryRun | undefined}
  | {label: 'Baseline'; run: ObservatoryRun | undefined}
  | undefined {
  if (!match) return undefined;
  return match.trajectory === selectedTrajectory
    ? {label: 'Selected', run: selected}
    : {label: 'Baseline', run: baseline};
}

export function relatedOracles(
  node: ObservatoryTrajectoryNode,
  ...runs: Array<ObservatoryRun | undefined>
) {
  return runs
    .flatMap((run) => run?.oracleResults ?? [])
    .filter((oracle) => node.relatedOracleIds.includes(oracle.oracleId));
}

export function TrajectoryComparison({
  selected,
  baseline,
  selectedNodeId,
  onSelectNode,
}: {
  selected: ObservatoryTrajectory;
  baseline?: ObservatoryTrajectory;
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
}) {
  if (!selected.graphRecommended) {
    return (
      <div className="trajectory-note">
        <strong>Graph omitted.</strong> {selected.recommendationReason}
      </div>
    );
  }
  return (
    <section className="trajectory-comparison">
      <div className="trajectory-heading">
        <div>
          <p className="eyebrow">Delegated trajectory</p>
          <h3>Linked execution graph</h3>
        </div>
        <p>
          Purple links are explicit parent/child relationships. The ordered
          event list remains the source for linear inspection.
        </p>
      </div>
      <Suspense
        fallback={<div className="trajectory-note">Loading graph…</div>}
      >
        <div className={`trajectory-graphs ${baseline ? 'has-baseline' : ''}`}>
          <article>
            <h4>Selected · {selected.runId}</h4>
            <div className="trajectory-canvas">
              <TrajectoryGraph
                trajectory={selected}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            </div>
            <small>{selected.recommendationReason}</small>
          </article>
          {baseline && (
            <article>
              <h4>Baseline · {baseline.runId}</h4>
              {baseline.graphRecommended ? (
                <div className="trajectory-canvas">
                  <TrajectoryGraph
                    trajectory={baseline}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={onSelectNode}
                  />
                </div>
              ) : (
                <div className="trajectory-note">Graph omitted.</div>
              )}
              <small>{baseline.recommendationReason}</small>
            </article>
          )}
        </div>
      </Suspense>
    </section>
  );
}

export function EventList({
  trajectory,
  selectedNodeId,
  onSelectNode,
}: {
  trajectory?: ObservatoryTrajectory;
  selectedNodeId?: string;
  onSelectNode: (nodeId?: string) => void;
}) {
  const events = (trajectory?.nodes ?? []).filter(
    (node) => node.sequence !== undefined,
  );
  if (events.length === 0) return <p className="answer">No events recorded.</p>;
  return (
    <ol className="event-list">
      {events.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className={selectedNodeId === node.id ? 'selected' : ''}
            aria-pressed={selectedNodeId === node.id}
            onClick={() => onSelectNode(node.id)}
          >
            <span>{node.sequence}</span>
            <strong>{node.kind}</strong>
            <span>{node.label}</span>
            <small>{node.status ?? 'recorded'}</small>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Filter({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value?: string;
  values: readonly string[];
  onChange: (value?: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function Detail({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <details open>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
