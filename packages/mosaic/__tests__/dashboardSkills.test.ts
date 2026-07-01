import {
  buildAgentSkillsInstructions,
  MOSAIC_DASHBOARD_SKILLS,
  MOSAIC_DASHBOARD_SKILL_ROOT,
  selectMosaicDashboardSkillIds,
} from '../src/ai';

describe('dashboard skills', () => {
  it('selects baseline and exploratory skills for open-ended dashboard requests', () => {
    expect(
      selectMosaicDashboardSkillIds('Create an overview dashboard'),
    ).toEqual([
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
    ]);
  });

  it('selects KPI and diagnostic skills when the intent asks for metric drivers', () => {
    expect(
      selectMosaicDashboardSkillIds('Explain why revenue changed last quarter'),
    ).toEqual([
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'kpi-dashboard',
      'diagnostic-dashboard',
    ]);
  });

  it('renders selected skill instructions with root ids for traces', async () => {
    const storage = {
      resolveSkillId: async (id: string) =>
        id === 'chart-selection'
          ? {rootId: MOSAIC_DASHBOARD_SKILL_ROOT.id, id}
          : null,
      readSkill: async () => ({
        ref: {rootId: MOSAIC_DASHBOARD_SKILL_ROOT.id, id: 'chart-selection'},
        manifest: MOSAIC_DASHBOARD_SKILLS[0].manifest,
        instructions: MOSAIC_DASHBOARD_SKILLS[0].instructions,
      }),
    };

    const result = await buildAgentSkillsInstructions({
      storage,
      skillIds: ['chart-selection', 'missing-skill'],
      heading: 'Selected Dashboard Skills',
    });

    expect(result.appliedSkills).toEqual([
      {rootId: MOSAIC_DASHBOARD_SKILL_ROOT.id, id: 'chart-selection'},
    ]);
    expect(result.instructions).toContain('## Selected Dashboard Skills');
    expect(result.instructions).toContain(
      `Root: ${MOSAIC_DASHBOARD_SKILL_ROOT.id}`,
    );
  });
});
