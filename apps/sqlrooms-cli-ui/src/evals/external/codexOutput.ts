/** Extracts observations from Codex JSONL without treating progress text as the final answer. */
export function readCodexOutput(stdout: string) {
  const records = stdout
    .split('\n')
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          type: string;
          item?: {
            type?: string;
            message?: string;
            text?: string;
            command?: string;
            aggregated_output?: string;
            exit_code?: number;
          };
          usage?: {input_tokens?: number; output_tokens?: number};
        },
    );
  const completedItems = records
    .filter((record) => record.type === 'item.completed')
    .map((record) => record.item);
  const messages = completedItems.filter(
    (item) => item?.type === 'agent_message',
  );
  const usages = records
    .filter((record) => record.type === 'turn.completed')
    .map((record) => record.usage);
  const diagnostics = completedItems
    .filter(
      (item) =>
        item?.type === 'error' ||
        (item?.type === 'command_execution' && item.exit_code !== 0),
    )
    .map((item) => ({
      message:
        item?.message ??
        `Command exited with ${item?.exit_code}: ${item?.command}`,
      severity:
        item?.message &&
        (item.message.startsWith('Skill descriptions were shortened to fit') ||
          /^Model metadata for `[^`]+` not found\. Defaulting to fallback metadata; this can degrade performance and cause issues\.$/.test(
            item.message,
          ))
          ? 'warning'
          : 'error',
    }));
  return {
    diagnostics,
    finalAnswer: messages[messages.length - 1]?.text ?? '',
    usage: usages[usages.length - 1],
    failed:
      records.some(
        (record) => record.type === 'turn.failed' || record.type === 'error',
      ) || diagnostics.some((item) => item.severity === 'error'),
    completed: records.some((record) => record.type === 'turn.completed'),
    skillReads: completedItems
      .filter(
        (item) =>
          item?.type === 'command_execution' &&
          item.exit_code === 0 &&
          item.command?.includes('.agents/skills/sqlrooms/'),
      )
      .map((item) => ({
        command: item!.command!,
        output: item!.aggregated_output ?? '',
      })),
  };
}
