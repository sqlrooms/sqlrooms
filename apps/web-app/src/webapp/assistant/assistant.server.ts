import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {
  convertToModelMessages,
  streamText,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';
import {and, count, eq, gte} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '#/db/index';
import {aiUsageEvents} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {requireEnv} from '#/lib/env';
import type {AssistantModelMode} from './modelModes';

const OPENROUTER_MODELS_BY_MODE = {
  fast: 'deepseek/deepseek-v4-flash',
  deep: 'deepseek/deepseek-v4-pro',
} satisfies Record<AssistantModelMode, string>;
const DEFAULT_DAILY_MESSAGE_LIMIT = 60;

const assistantChatInput = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1).max(80),
  model: z.enum(['fast', 'deep']).optional(),
  instructions: z.string().trim().max(12000).optional(),
});

export async function runAssistantChat(request: Request) {
  const data = assistantChatInput.parse(await request.json());
  const {userId} = await verifyAuthToken(readBearerToken(request));
  await assertCanUseAssistant(userId);

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

  const result = streamText({
    model: openrouter.chatModel(modelId),
    system: data.instructions || createSystemPrompt(),
    messages: await convertToModelMessages(data.messages),
    temperature: 0.2,
    onFinish: async ({usage}) => {
      await recordAiUsage({
        userId,
        model: modelId,
        usage,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}

function resolveOpenRouterModel(modelMode: AssistantModelMode = 'fast') {
  return OPENROUTER_MODELS_BY_MODE[modelMode];
}

function createSystemPrompt() {
  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan worksheets, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.`;
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AssistantError(
      'Sign in to use the assistant.',
      401,
      'ASSISTANT_AUTH_REQUIRED',
    );
  }
  return match[1];
}

async function assertCanUseAssistant(userId: string) {
  const dailyLimit = Number.parseInt(
    process.env.AI_DAILY_MESSAGE_LIMIT || '',
    10,
  );
  const limit = Number.isFinite(dailyLimit)
    ? dailyLimit
    : DEFAULT_DAILY_MESSAGE_LIMIT;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({value: count()})
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        eq(aiUsageEvents.provider, 'openrouter'),
        gte(aiUsageEvents.createdAt, since),
      ),
    );

  if ((rows[0]?.value ?? 0) >= limit) {
    throw new AssistantError(
      `Daily assistant limit reached (${limit} messages).`,
      429,
      'ASSISTANT_LIMIT_REACHED',
    );
  }
}

async function recordAiUsage({
  userId,
  model,
  usage,
}: {
  userId: string;
  model: string;
  usage: LanguageModelUsage | undefined;
}) {
  await db.insert(aiUsageEvents).values({
    userId,
    provider: 'openrouter',
    model,
    purpose: 'chat',
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
    cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
  });
}

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}
