import {
  BundledSkillStorage,
  CompositeSkillStorage,
  type BundledSkillDefinition,
  type SkillStorage,
} from '@sqlrooms/ai';
import {
  MOSAIC_DASHBOARD_SKILLS,
  MOSAIC_DASHBOARD_SKILL_ROOT,
  selectMosaicDashboardSkillIds,
} from '@sqlrooms/mosaic/ai';

/**
 * Read-only skill root for SQLRooms CLI dashboard and worksheet policy.
 */
export const SQLROOMS_CLI_DASHBOARD_SKILL_ROOT = {
  id: 'app:sqlrooms-cli-ui',
  label: 'SQLRooms CLI dashboard skills',
  writable: false,
} as const;

/**
 * App-owned skills that specialize reusable Mosaic dashboard guidance for the
 * SQLRooms CLI artifact and worksheet surfaces.
 */
export const SQLROOMS_CLI_DASHBOARD_SKILLS = [
  {
    id: 'sqlrooms-cli-dashboard-routing',
    manifest: {
      id: 'sqlrooms-cli-dashboard-routing',
      version: '0.1.0',
      name: 'SQLRooms CLI Dashboard Routing',
      description:
        'Choose between dashboard artifacts, worksheet dashboard blocks, chart blocks, and embedded agents.',
    },
    instructions: `
Use this skill inside the SQLRooms CLI app when deciding how dashboard work should be routed.

- If the primary artifact is a worksheet, prefer worksheet blocks and worksheet-scoped tools.
- If the user explicitly asks for an interactive dashboard inside a worksheet, create or reuse a dashboard block, then call the embedded dashboard agent.
- If the primary artifact is a dashboard artifact, call the dashboard agent directly.
- If the user asks for one or two simple worksheet charts, create chart blocks directly instead of creating a dashboard block.
- If the request is exploratory, multi-view, map-heavy, or benefits from coordinated filters, prefer a dashboard block or dashboard artifact.
- If targeting is ambiguous across multiple existing stateful blocks, inspect blocks before mutating one.

This skill does not grant tools. Use command-backed worksheet and dashboard operations for durable changes.
`.trim(),
  },
  {
    id: 'sqlrooms-cli-worksheet-dashboard-block',
    manifest: {
      id: 'sqlrooms-cli-worksheet-dashboard-block',
      version: '0.1.0',
      name: 'SQLRooms CLI Worksheet Dashboard Block',
      description:
        'Guide creation, reuse, and follow-up edits for dashboard blocks embedded in worksheets.',
    },
    instructions: `
Use this skill when a dashboard lives inside a SQLRooms worksheet.

- Create the dashboard block container before populating it with the embedded dashboard agent.
- Reuse an existing dashboard block when the user's request is a follow-up or refinement.
- Pass the dashboard block's stateful block instance id as dashboardId to the embedded dashboard agent.
- Keep worksheet surrounding text short: headings or captions should orient the dashboard, not duplicate every panel.
- For map requests without direct worksheet map tools, route through a dashboard block that can host map panels.
- For follow-up edits, inspect worksheet blocks and existing dashboard panels before adding a new dashboard.

Do not bypass worksheet commands or mutate block document state through hidden mechanisms.
`.trim(),
  },
  {
    id: 'sqlrooms-cli-dashboard-polish',
    manifest: {
      id: 'sqlrooms-cli-dashboard-polish',
      version: '0.1.0',
      name: 'SQLRooms CLI Dashboard Polish',
      description:
        'Apply SQLRooms CLI defaults for dashboard titles, captions, summaries, and follow-up behavior.',
    },
    instructions: `
Use this skill for SQLRooms CLI dashboard presentation defaults.

- Use concise dashboard and panel titles that match the user's artifact context.
- Prefer practical first drafts over exhaustive dashboards; users can refine interactively.
- Add brief summary text around worksheet dashboard blocks only when it helps the worksheet read naturally.
- Preserve existing dashboard intent when editing unless the user clearly asks to repurpose it.
- Keep user-facing summaries honest about uncertainty and unsupported runtime capabilities.
- Prefer visible command/tool paths over hidden agent-only state changes.

Do not duplicate Mosaic chart-selection guidance here; defer chart theory to package-owned Mosaic skills.
`.trim(),
  },
] satisfies ReadonlyArray<BundledSkillDefinition>;

/**
 * Build the SQLRooms CLI skill catalog in priority order:
 * workspace, user, app bundled skills, then package bundled skills.
 */
export function createSqlroomsCliDashboardSkillStorage({
  workspaceStorage,
  userStorage,
}: {
  workspaceStorage?: SkillStorage;
  userStorage?: SkillStorage;
} = {}): SkillStorage {
  const storages = [
    workspaceStorage,
    userStorage,
    new BundledSkillStorage(
      SQLROOMS_CLI_DASHBOARD_SKILL_ROOT,
      SQLROOMS_CLI_DASHBOARD_SKILLS,
    ),
    new BundledSkillStorage(
      MOSAIC_DASHBOARD_SKILL_ROOT,
      MOSAIC_DASHBOARD_SKILLS,
    ),
  ].filter((storage): storage is SkillStorage => Boolean(storage));

  return new CompositeSkillStorage(storages);
}

/**
 * Select app and package dashboard skills for a single CLI agent run.
 */
export function selectSqlroomsCliDashboardSkillIds({
  agent,
  intent,
}: {
  agent: 'dashboard' | 'worksheet';
  intent: string;
}): ReadonlyArray<string> {
  const skillIds = new Set<string>(selectMosaicDashboardSkillIds(intent));

  if (agent === 'worksheet') {
    skillIds.add('sqlrooms-cli-dashboard-routing');
    skillIds.add('sqlrooms-cli-worksheet-dashboard-block');
  }

  skillIds.add('sqlrooms-cli-dashboard-polish');

  return [...skillIds];
}
