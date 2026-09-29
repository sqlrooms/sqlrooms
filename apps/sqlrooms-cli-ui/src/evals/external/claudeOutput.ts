type Block = {
  type: string;
  id?: string;
  name?: string;
  input?: {skill?: string; file_path?: string};
  tool_use_id?: string;
  is_error?: boolean;
  content?: string | Array<{type: string; text?: string}>;
};
type Record = {
  type: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  errors?: string[];
  model?: string;
  message?: {model?: string; content?: Block[]};
  usage?: {input_tokens?: number; output_tokens?: number};
};

/** Reads Claude's public stream-json events; only the result event is graded. */
export function readClaudeOutput(stdout: string) {
  const records = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record);
  const uses = new Map<string, Block>();
  const skillReads: Array<{command: string; output: string}> = [];
  let skillInvoked = false;
  for (const record of records) {
    for (const block of record.message?.content ?? []) {
      if (record.type === 'assistant' && block.type === 'tool_use' && block.id)
        uses.set(block.id, block);
      if (
        record.type !== 'user' ||
        block.type !== 'tool_result' ||
        block.is_error
      )
        continue;
      const use = uses.get(block.tool_use_id ?? '');
      if (use?.name === 'Skill' && use.input?.skill === 'sqlrooms:sqlrooms')
        skillInvoked = true;
      if (
        use?.name !== 'Read' ||
        !use.input?.file_path?.includes('/skills/sqlrooms/')
      )
        continue;
      const output =
        typeof block.content === 'string'
          ? block.content
          : (block.content ?? []).map((part) => part.text ?? '').join('\n');
      // Read includes line-number prefixes; retain the raw stream separately.
      // Strip only the prefix so content indentation survives.
      skillReads.push({
        command: use.input.file_path,
        output: output.replace(/^ *\d+(?:→|\t)/gm, ''),
      });
    }
  }
  const result = [...records]
    .reverse()
    .find((record) => record.type === 'result');
  return {
    finalAnswer: result?.result ?? '',
    completed: Boolean(result),
    failed: !result || result.is_error === true || result.subtype !== 'success',
    diagnostics: (result?.errors ?? []).map((message) => ({
      message,
      severity: 'error',
    })),
    usage: result?.usage,
    observedModelId:
      records.find(
        (record) =>
          record.type === 'assistant' &&
          record.message?.model &&
          record.message.model !== '<synthetic>',
      )?.message?.model ?? null,
    skillReads,
    skillInvoked,
  };
}
