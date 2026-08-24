import type {ObservatoryRun} from './readModel.js';

/** Failure classes used while calibrating behavioral canaries. */
export type EvalFailureClass =
  | 'model-variability'
  | 'upstream-provider'
  | 'harness-defect'
  | 'profile-defect'
  | 'behavioral-regression'
  | 'unclassified';

/** Human classification attached outside the immutable source database. */
export type EvalFailureClassification = {
  runId: string;
  classification: EvalFailureClass;
  note?: string;
};

/** Pass-rate row that keeps scenario, check, model, and revision explicit. */
export type CalibrationRate = {
  scenarioId: string;
  scenarioVersion?: number;
  checkId: string;
  modelId: string;
  revision?: string;
  total: number;
  passed: number;
  passRate: number;
};

/** Computes per-scenario/per-check rates without inventing release thresholds. */
export function computeCalibrationRates(
  runs: readonly ObservatoryRun[],
): CalibrationRate[] {
  const groups = new Map<
    string,
    Omit<CalibrationRate, 'total' | 'passed' | 'passRate'> & {
      total: number;
      passed: number;
    }
  >();
  for (const run of runs) {
    for (const check of run.checkResults) {
      const identity = {
        scenarioId: run.scenario.id,
        scenarioVersion: run.scenario.version,
        checkId: check.checkId,
        modelId: run.model.modelId,
        revision: run.model.revision,
      };
      const key = JSON.stringify(identity);
      const group = groups.get(key) ?? {...identity, total: 0, passed: 0};
      group.total += 1;
      group.passed += Number(check.pass);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    passRate: group.total > 0 ? group.passed / group.total : 0,
  }));
}

/** Joins analyst classifications without modifying retained Promptfoo history. */
export function attachFailureClassifications(
  runs: readonly ObservatoryRun[],
  classifications: readonly EvalFailureClassification[],
) {
  const byRun = new Map(
    classifications.map((classification) => [
      classification.runId,
      classification,
    ]),
  );
  return runs.map((run) => ({
    run,
    classification:
      run.status === 'passed'
        ? undefined
        : (byRun.get(run.id) ?? {
            runId: run.id,
            classification: 'unclassified' as const,
          }),
  }));
}
