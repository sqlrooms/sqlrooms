import {
  createSqlroomsCliDashboardSkillStorage,
  SQLROOMS_CLI_DASHBOARD_SKILL_ROOT,
  selectSqlroomsCliDashboardSkillIds,
} from '../dashboardSkills';
import {DASHBOARD_SKILL_TRACES} from '../dashboardSkillTraces';

describe('SQLRooms CLI dashboard skills', () => {
  it('composes app skills before package skills', async () => {
    const storage = createSqlroomsCliDashboardSkillStorage();

    await expect(storage.listRoots()).resolves.toMatchObject([
      SQLROOMS_CLI_DASHBOARD_SKILL_ROOT,
      {id: 'package:@sqlrooms/mosaic'},
    ]);
  });

  it('selects worksheet routing skills with package dashboard skills', () => {
    expect(
      selectSqlroomsCliDashboardSkillIds({
        agent: 'worksheet',
        intent: 'Add a dashboard to the current worksheet',
      }),
    ).toEqual([
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
      'sqlrooms-cli-dashboard-routing',
      'sqlrooms-cli-worksheet-dashboard-block',
      'sqlrooms-cli-dashboard-polish',
    ]);
  });

  it('keeps top-level dashboard agent selection focused on dashboard polish', () => {
    expect(
      selectSqlroomsCliDashboardSkillIds({
        agent: 'dashboard',
        intent: 'Create a KPI dashboard',
      }),
    ).toEqual([
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'kpi-dashboard',
      'sqlrooms-cli-dashboard-polish',
    ]);
  });

  it.each(DASHBOARD_SKILL_TRACES)(
    'matches expected selected skills for $id',
    (trace) => {
      expect(
        selectSqlroomsCliDashboardSkillIds({
          agent: trace.agent,
          intent: trace.prompt,
        }),
      ).toEqual(trace.expectedSkillIds);
    },
  );
});
