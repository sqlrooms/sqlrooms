/**
 * Expected dashboard-skill traces for the first SQLRooms CLI dashboard slice.
 */
export type DashboardSkillTrace = {
  id: string;
  prompt: string;
  agent: 'dashboard' | 'worksheet';
  expectedSkillIds: string[];
  expectedAgentPath: string;
  expectedDurableActions: string[];
  expectedResult: string;
  unacceptableOutcomes: string[];
};

/**
 * Small deterministic trace suite used to guard skill selection and routing
 * expectations before adding more skill families.
 */
export const DASHBOARD_SKILL_TRACES: DashboardSkillTrace[] = [
  {
    id: 'exploratory-dashboard',
    prompt: 'Create an exploratory dashboard for this table.',
    agent: 'dashboard',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath: 'dashboard_agent -> dashboard panel tools',
    expectedDurableActions: [
      'dashboard.set-selected-table',
      'dashboard.add-panel',
    ],
    expectedResult: '3-5 complementary dashboard panels',
    unacceptableOutcomes: ['chat-only charts', 'no durable dashboard panels'],
  },
  {
    id: 'kpi-dashboard',
    prompt: 'Create a KPI dashboard.',
    agent: 'dashboard',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'kpi-dashboard',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath: 'dashboard_agent -> query -> dashboard panel tools',
    expectedDurableActions: [
      'dashboard.set-selected-table',
      'dashboard.add-panel',
    ],
    expectedResult: 'headline metric trend and useful breakdown panels',
    unacceptableOutcomes: ['raw counts without context', 'text-only answer'],
  },
  {
    id: 'diagnostic-dashboard',
    prompt: 'Explain why revenue changed.',
    agent: 'dashboard',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'kpi-dashboard',
      'diagnostic-dashboard',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath: 'dashboard_agent -> query -> dashboard panel tools',
    expectedDurableActions: [
      'dashboard.set-selected-table',
      'dashboard.add-panel',
    ],
    expectedResult: 'comparison and segment-driver panels with uncertainty',
    unacceptableOutcomes: ['unsupported causal claims', 'no comparison frame'],
  },
  {
    id: 'worksheet-dashboard-block',
    prompt: 'Add a dashboard to the current worksheet.',
    agent: 'worksheet',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
      'sqlrooms-cli-dashboard-routing',
      'sqlrooms-cli-worksheet-dashboard-block',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath:
      'worksheet_agent -> add_dashboard_block -> embedded_dashboard_agent',
    expectedDurableActions: [
      'block-document.add-dashboard-block',
      'dashboard.add-panel',
    ],
    expectedResult: 'worksheet dashboard block populated with panels',
    unacceptableOutcomes: [
      'top-level dashboard artifact',
      'standalone chat chart',
    ],
  },
  {
    id: 'map-heavy-dashboard',
    prompt: 'Add a map-heavy dashboard.',
    agent: 'worksheet',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
      'sqlrooms-cli-dashboard-routing',
      'sqlrooms-cli-worksheet-dashboard-block',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath:
      'worksheet_agent -> worksheet map tool or embedded_dashboard_agent',
    expectedDurableActions: [
      'block-document.add-map-block or block-document.add-dashboard-block',
      'dashboard.add-panel when routed through a dashboard',
    ],
    expectedResult: 'map-centered worksheet or dashboard with supporting views',
    unacceptableOutcomes: ['markdown-only map', 'unsupported map panel claim'],
  },
  {
    id: 'refine-existing-dashboard',
    prompt: 'Refine this existing dashboard.',
    agent: 'dashboard',
    expectedSkillIds: [
      'chart-selection',
      'dashboard-design-principles',
      'mosaic-dashboard-runtime',
      'exploratory-dashboard',
      'sqlrooms-cli-dashboard-polish',
    ],
    expectedAgentPath:
      'dashboard_agent -> list_dashboard_panels -> panel tools',
    expectedDurableActions: [
      'dashboard.update-panel',
      'dashboard.add-panel when needed',
    ],
    expectedResult: 'targeted dashboard refinement preserving existing intent',
    unacceptableOutcomes: [
      'blind duplicate dashboard',
      'untargeted panel edits',
    ],
  },
];
