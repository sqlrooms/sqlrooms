import {
  DEFAULT_SKILL_RUNTIME_TOOL_POLICY,
  createSkillRuntimeToolPolicy,
} from '../src/tools/skillRuntimeToolPolicy';

describe('skill runtime tool policy', () => {
  it('defaults high-level agent tools to package-generic names', () => {
    expect(DEFAULT_SKILL_RUNTIME_TOOL_POLICY.highLevelAgentTools).toEqual([
      'block_document_agent',
      'dashboard_agent',
      'html_app_agent',
    ]);
  });

  it('lets hosts substitute product-specific high-level agent tool names', () => {
    const policy = createSkillRuntimeToolPolicy({
      highLevelAgentTools: [
        'host_block_document_agent',
        'dashboard_agent',
        'html_app_agent',
      ],
    });

    expect(policy.highLevelAgentTools).toEqual([
      'host_block_document_agent',
      'dashboard_agent',
      'html_app_agent',
    ]);
    expect(DEFAULT_SKILL_RUNTIME_TOOL_POLICY.highLevelAgentTools).toEqual([
      'block_document_agent',
      'dashboard_agent',
      'html_app_agent',
    ]);
  });

  it('does not share nested command tool arrays with the default policy', () => {
    const policy = createSkillRuntimeToolPolicy();

    policy.commandTools.discoveryTools.push('custom_search');
    policy.commandTools.allowedDiscoveryRiskLevels.pop();
    policy.commandTools.confirmationRequiredRiskLevels.push('medium');
    policy.commandTools.confirmationMetadataFields.push('customField');

    expect(DEFAULT_SKILL_RUNTIME_TOOL_POLICY.commandTools).toMatchObject({
      discoveryTools: ['search_commands', 'find_commands'],
      allowedDiscoveryRiskLevels: ['low', 'medium', 'high'],
      confirmationRequiredRiskLevels: ['high'],
      confirmationMetadataFields: ['riskLevel', 'requiresConfirmation'],
    });
  });
});
