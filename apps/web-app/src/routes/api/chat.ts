import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: ({request}) => handleAssistantChatRequest(request),
    },
  },
});

async function handleAssistantChatRequest(request: Request) {
  try {
    const body = await request.json();
    const {runAssistantChat} =
      await import('#/webapp/assistant/assistant.server');
    return Response.json(await runAssistantChat(body));
  } catch (error) {
    if (isAssistantError(error)) {
      return Response.json(
        {error: error.message, code: error.code},
        {status: error.status},
      );
    }

    console.error('Assistant request failed', error);
    return Response.json(
      {error: 'Assistant request failed.', code: 'ASSISTANT_ERROR'},
      {status: 500},
    );
  }
}

function isAssistantError(
  error: unknown,
): error is {message: string; status: number; code: string} {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  );
}
