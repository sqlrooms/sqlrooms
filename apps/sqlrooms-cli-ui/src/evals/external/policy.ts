import type {RoomCapabilityPolicy} from '@sqlrooms/mcp';

/** Trusted host policy for disposable fixtures only; never used by the browser. */
export const EXTERNAL_EVAL_POLICY = {
  id: 'isolated-document-charts-maps-v1',
  database: 'DuckDB Node :memory:; ambiguous-geospatial-v1',
  queries:
    'One bounded SELECT; external access disabled after connector initialization. Not an OS sandbox or a query resource-cost limit.',
  capabilities: [
    'query',
    'list_tables',
    'read_table_schema',
    'search_commands',
    'get_command',
    'execute_command',
  ],
  commands: [
    'block-document.list',
    'block-document.get',
    'block-document.get-map',
    'block-document.create-artifact',
    'block-document.create-chart-block',
    'block-document.add-map-block',
    'block-document.update-block',
    'block-document.append-blocks',
  ],
  confirmation:
    'No automatic confirmation; existing validation and denials apply.',
  targets:
    'Explicit document IDs required for document reads and mutations; all resources belong to this disposable workspace.',
} as const;

/** Restricts invocation, including attempts through generic execute_command. */
export const isolatedEvalPolicy: RoomCapabilityPolicy = {
  authorize: ({capability, input}) => {
    const deny = (message: string) => ({
      allowed: false as const,
      result: {ok: false as const, code: 'permission_denied', message},
    });
    if (
      !(EXTERNAL_EVAL_POLICY.capabilities as readonly string[]).includes(
        capability.name,
      )
    )
      return deny('Capability is outside the evaluation policy.');
    if (capability.name !== 'execute_command') return {allowed: true};
    const request = input as {
      commandId: string;
      input?: Record<string, unknown>;
    };
    if (
      !(EXTERNAL_EVAL_POLICY.commands as readonly string[]).includes(
        request.commandId,
      )
    )
      return deny('Command is outside the evaluation policy.');
    if (
      !['block-document.list', 'block-document.create-artifact'].includes(
        request.commandId,
      )
    ) {
      const idKey = [
        'block-document.add-map-block',
        'block-document.get-map',
      ].includes(request.commandId)
        ? 'blockDocumentId'
        : 'artifactId';
      if (typeof request.input?.[idKey] !== 'string' || !request.input[idKey])
        return deny(`Explicit ${idKey} is required.`);
    }
    return {allowed: true};
  },
};
