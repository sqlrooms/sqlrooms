import type {RoomCommandRiskLevel} from '@sqlrooms/room-shell';

export type SkillRuntimeCommandToolPolicy = {
  discoveryTools: string[];
  detailTool: string;
  executeTool: string;
  broadListTool: string;
  broadListUsage: 'debug-only';
  defaultIncludeHidden: boolean;
  defaultIncludeDisabled: boolean;
  allowedDiscoveryRiskLevels: RoomCommandRiskLevel[];
  confirmationRequiredRiskLevels: RoomCommandRiskLevel[];
  confirmationMetadataFields: string[];
};

export type SkillRuntimeToolPolicy = {
  commandTools: SkillRuntimeCommandToolPolicy;
  artifactContextTools: string[];
  dataTools: string[];
  highLevelAgentTools: string[];
  futureTools: string[];
  traceMetadataFields: string[];
};

export type CreateSkillRuntimeToolPolicyOptions = {
  /**
   * Host-provided high-level agent tool names. Use this when an app exposes a
   * product-specific block document agent.
   */
  highLevelAgentTools?: string[];
};

/**
 * Default tool policy for future skill runtimes.
 *
 * The policy keeps commands discoverable through compact search/detail tools,
 * reserves full command listings for debugging, and records the trace metadata
 * that skill runtimes should pass through command execution.
 */
export const DEFAULT_SKILL_RUNTIME_TOOL_POLICY: SkillRuntimeToolPolicy = {
  commandTools: {
    discoveryTools: ['search_commands', 'find_commands'],
    detailTool: 'get_command',
    executeTool: 'execute_command',
    broadListTool: 'list_commands',
    broadListUsage: 'debug-only',
    defaultIncludeHidden: false,
    defaultIncludeDisabled: false,
    allowedDiscoveryRiskLevels: ['low', 'medium', 'high'],
    confirmationRequiredRiskLevels: ['high'],
    confirmationMetadataFields: ['riskLevel', 'requiresConfirmation'],
  },
  artifactContextTools: [
    'list_context_artifacts',
    'read_context_artifact',
    'set_primary_context_artifact',
  ],
  dataTools: ['list_tables', 'read_table_schema', 'query'],
  highLevelAgentTools: [
    'block_document_agent',
    'dashboard_agent',
    'html_app_agent',
  ],
  futureTools: ['runSkill'],
  traceMetadataFields: [
    'commandId',
    'surface',
    'aiSessionId',
    'skillId',
    'toolCallId',
    'traceId',
    'validatedInput',
    'resultCode',
    'resultMessage',
    'targetArtifactChange',
  ],
};

/**
 * Creates a skill-runtime policy with host-specific tool-name substitutions.
 */
export function createSkillRuntimeToolPolicy({
  highLevelAgentTools = DEFAULT_SKILL_RUNTIME_TOOL_POLICY.highLevelAgentTools,
}: CreateSkillRuntimeToolPolicyOptions = {}): SkillRuntimeToolPolicy {
  return {
    ...DEFAULT_SKILL_RUNTIME_TOOL_POLICY,
    commandTools: {...DEFAULT_SKILL_RUNTIME_TOOL_POLICY.commandTools},
    artifactContextTools: [
      ...DEFAULT_SKILL_RUNTIME_TOOL_POLICY.artifactContextTools,
    ],
    dataTools: [...DEFAULT_SKILL_RUNTIME_TOOL_POLICY.dataTools],
    highLevelAgentTools: [...highLevelAgentTools],
    futureTools: [...DEFAULT_SKILL_RUNTIME_TOOL_POLICY.futureTools],
    traceMetadataFields: [
      ...DEFAULT_SKILL_RUNTIME_TOOL_POLICY.traceMetadataFields,
    ],
  };
}
