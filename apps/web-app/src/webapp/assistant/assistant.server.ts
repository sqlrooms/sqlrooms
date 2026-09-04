import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';
import {and, eq, sql} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '#/db/index';
import {aiUsageCounters, aiUsageEvents} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {requireEnv} from '#/lib/env';
import {AssistantError, authenticateAssistantRequest} from './assistantRequest';
import {resolveOpenRouterModel} from './openRouterModel';
const DEFAULT_DAILY_MESSAGE_LIMIT = 60;

const assistantChatInput = z.object({
  messages: z.array(z.unknown()).min(1).max(80),
  model: z.enum(['fast', 'deep']).optional(),
  instructions: z.string().trim().max(12000).optional(),
});

export async function runAssistantChat(request: Request) {
  const {userId} = await authenticateAssistantRequest(request, verifyAuthToken);
  const data = await parseAssistantChatInput(request);
  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({messages: data.messages});
  } catch {
    throw invalidAssistantRequest();
  }

  const modelId = resolveOpenRouterModel(data.model);
  const openrouter = createOpenAICompatible({
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? '',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'SQLRooms',
    },
  });
  const usageEventId = await reserveAssistantUsage(userId, modelId);

  const result = streamText({
    model: openrouter.chatModel(modelId),
    system: data.instructions || createSystemPrompt(),
    messages: await convertToModelMessages(messages),
    temperature: 0.2,
    abortSignal: request.signal,
    onFinish: async ({usage}) => {
      try {
        await recordAiUsage({usageEventId, userId, usage});
      } catch (error) {
        console.error('Could not record assistant usage', error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

async function parseAssistantChatInput(request: Request) {
  try {
    const parsed = assistantChatInput.safeParse(await request.json());
    if (parsed.success) return parsed.data;
  } catch {
    // Fall through to the same intentionally generic client error.
  }
  throw invalidAssistantRequest();
}

function invalidAssistantRequest() {
  return new AssistantError(
    'Invalid assistant request.',
    400,
    'ASSISTANT_INVALID_REQUEST',
  );
}

function createSystemPrompt() {
  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan documents, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.`;
}

async function reserveAssistantUsage(userId: string, model: string) {
  const dailyLimit = Number.parseInt(
    process.env.AI_DAILY_MESSAGE_LIMIT || '',
    10,
  );
  const limit =
    Number.isFinite(dailyLimit) && dailyLimit > 0
      ? dailyLimit
      : DEFAULT_DAILY_MESSAGE_LIMIT;
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const reservation = await db.execute<{id: string}>(sql`
    with quota as (
      insert into ${aiUsageCounters}
        (user_id, provider, window_started_at, message_count, updated_at)
      values (${userId}, 'openrouter', ${now}, 1, ${now})
      on conflict (user_id, provider) do update set
        window_started_at = case
          when ${aiUsageCounters.windowStartedAt} < ${windowCutoff} then ${now}
          else ${aiUsageCounters.windowStartedAt}
        end,
        message_count = case
          when ${aiUsageCounters.windowStartedAt} < ${windowCutoff} then 1
          else ${aiUsageCounters.messageCount} + 1
        end,
        updated_at = ${now}
      where ${aiUsageCounters.windowStartedAt} < ${windowCutoff}
        or ${aiUsageCounters.messageCount} < ${limit}
      returning user_id
    )
    insert into ${aiUsageEvents}
      (user_id, provider, model, purpose)
    select ${userId}, 'openrouter', ${model}, 'chat' from quota
    returning id
  `);

  const usageEventId = reservation.rows[0]?.id;
  if (!usageEventId) {
    throw new AssistantError(
      `Daily assistant limit reached (${limit} messages).`,
      429,
      'ASSISTANT_LIMIT_REACHED',
    );
  }
  return usageEventId;
}

async function recordAiUsage({
  usageEventId,
  userId,
  usage,
}: {
  usageEventId: string;
  userId: string;
  usage: LanguageModelUsage | undefined;
}) {
  await db
    .update(aiUsageEvents)
    .set({
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
      cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
    })
    .where(
      and(eq(aiUsageEvents.id, usageEventId), eq(aiUsageEvents.userId, userId)),
    );
}
