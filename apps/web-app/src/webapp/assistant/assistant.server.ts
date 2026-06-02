import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {generateText, type LanguageModelUsage} from 'ai';
import {and, count, eq, gte} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '#/db/index';
import {aiUsageEvents} from '#/db/schema';
import {verifyAuthToken} from '#/lib/auth-token';
import {requireEnv} from '#/lib/env';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_DAILY_MESSAGE_LIMIT = 60;

const chatMessageInput = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(8000),
});

const assistantChatInput = z.object({
  token: z.string().min(1),
  messages: z.array(chatMessageInput).min(1).max(20),
  context: z.object({
    workspaceTitle: z.string().trim().max(160).optional(),
    worksheetTitles: z.array(z.string().trim().max(160)).max(20).default([]),
    tables: z.array(z.string().trim().max(160)).max(80).default([]),
  }),
});

type AssistantChatInput = z.infer<typeof assistantChatInput>;

export async function runAssistantChat(input: unknown) {
  const data = assistantChatInput.parse(input);
  const {userId} = await verifyAuthToken(data.token);
  await assertCanUseAssistant(userId);

  const modelId = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const openrouter = createOpenAICompatible({
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? '',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'SQLRooms',
    },
  });

  const result = await generateText({
    model: openrouter.chatModel(modelId),
    system: createSystemPrompt(data.context),
    messages: data.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    temperature: 0.2,
  });

  await recordAiUsage({
    userId,
    model: modelId,
    usage: result.usage,
  });

  return {
    message: {
      role: 'assistant' as const,
      content: result.text,
    },
    usage: serializeUsage(result.usage),
  };
}

function createSystemPrompt(context: AssistantChatInput['context']) {
  const worksheetLines = context.worksheetTitles.length
    ? context.worksheetTitles.map((title) => `- ${title}`).join('\n')
    : '- none';
  const tableLines = context.tables.length
    ? context.tables.map((table) => `- ${table}`).join('\n')
    : '- none';

  return `You are the SQLRooms assistant for a browser-based data analysis workspace.
Help the user reason about datasets, write SQL, plan worksheets, and design charts or dashboards.
Be concise, practical, and explicit about assumptions. Do not claim to inspect data unless the user has provided it in the chat.

Workspace: ${context.workspaceTitle || 'Untitled Workspace'}

Worksheets:
${worksheetLines}

Available tables:
${tableLines}`;
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

function serializeUsage(usage: LanguageModelUsage | undefined) {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? 0,
    cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
  };
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
