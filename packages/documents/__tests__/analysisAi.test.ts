import {
  ANALYSIS_AGENT_COMMAND_IDS,
  ANALYSIS_AGENT_TOOL_NAME,
  createAnalysisAuthoringInstructions,
} from '../src';

describe('analysis AI helpers', () => {
  it('describes the command surface used by analysis authoring agents', () => {
    expect(ANALYSIS_AGENT_TOOL_NAME).toBe('analysis_agent');
    expect(ANALYSIS_AGENT_COMMAND_IDS).toContain('analysis.create');
    expect(ANALYSIS_AGENT_COMMAND_IDS).toContain('analysis.create-chart-block');
    expect(ANALYSIS_AGENT_COMMAND_IDS).toContain('analysis.embed-dashboard');
  });

  it('builds authoring instructions with configurable tool names', () => {
    const instructions = createAnalysisAuthoringInstructions({
      commandToolName: 'run_command',
      analysisAgentToolName: 'analysis_writer',
    });

    expect(instructions).toContain('run_command');
    expect(instructions).toContain('analysis_writer');
    expect(instructions).toContain('analysis.create-chart-block');
    expect(instructions).toContain('selectionGroupId');
  });
});
