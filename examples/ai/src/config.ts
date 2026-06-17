import type {AiSettingsSliceConfig} from '@sqlrooms/ai-settings';

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

export const AI_SETTINGS: Pick<
  AiSettingsSliceConfig,
  'defaultProvider' | 'defaultModel' | 'providers'
> = {
  defaultProvider: 'openai',
  defaultModel: 'gpt-5',
  providers: {
    openai: {
      title: 'OpenAI',
      kind: 'builtin',
      baseUrl: 'https://api.openai.com/v1',
      models: [{modelName: 'gpt-5'}, {modelName: 'gpt-4.1'}],
      defaultAuthMethod: 'manual_api_key',
      authMethods: [
        {
          id: 'manual_api_key',
          type: 'api_key',
          label: 'Manually enter API Key',
          description: 'Works with the standard OpenAI API.',
          experimental: false,
          metadata: {},
        },
        {
          id: 'chatgpt_browser',
          type: 'oauth_popup',
          label: 'ChatGPT Pro/Plus (browser)',
          description:
            'Experimental browser-first sign-in flow for ChatGPT-backed access.',
          experimental: true,
          metadata: {
            authUrl: 'https://chatgpt.com/',
          },
        },
        {
          id: 'chatgpt_headless',
          type: 'device_code',
          label: 'ChatGPT Pro/Plus (headless)',
          description:
            'Experimental code-based flow that can be completed without popup handling.',
          experimental: true,
          metadata: {
            authUrl: 'https://chatgpt.com/',
          },
        },
      ],
      experimental: true,
      status: {
        hasCredentials: false,
        credentialType: null,
        selectedAuthMethod: null,
        expiresAt: null,
        status: 'disconnected',
      },
    },
    anthropic: {
      title: 'Anthropic',
      kind: 'builtin',
      baseUrl: 'https://api.anthropic.com/v1',
      models: [
        {modelName: 'claude-opus-4-6'},
        {modelName: 'claude-sonnet-4-6'},
      ],
      defaultAuthMethod: 'manual_api_key',
      authMethods: [
        {
          id: 'manual_api_key',
          type: 'api_key',
          label: 'Manually enter API Key',
          description: 'Works with the standard Anthropic API.',
          experimental: false,
          metadata: {},
        },
        {
          id: 'claude_pro_max',
          type: 'oauth_redirect',
          label: 'Claude Pro/Max',
          description:
            'Experimental browser flow for Claude account-based access.',
          experimental: true,
          metadata: {
            authUrl: 'https://claude.ai/',
          },
        },
        {
          id: 'create_api_key',
          type: 'oauth_to_api_key',
          label: 'Create an API Key',
          description:
            'Experimental browser flow that ends with an API-compatible key.',
          experimental: true,
          metadata: {
            authUrl: 'https://console.anthropic.com/',
          },
        },
      ],
      experimental: true,
      status: {
        hasCredentials: false,
        credentialType: null,
        selectedAuthMethod: null,
        expiresAt: null,
        status: 'disconnected',
      },
    },
    ollama: {
      title: 'Ollama',
      kind: 'local',
      baseUrl: OLLAMA_DEFAULT_BASE_URL,
      models: [{modelName: 'qwen3:32b'}, {modelName: 'gpt-oss'}],
      defaultAuthMethod: 'local_runtime',
      authMethods: [
        {
          id: 'local_runtime',
          type: 'local',
          label: 'Use local runtime',
          description:
            'Connect to a local Ollama server running on your machine.',
          experimental: false,
          metadata: {},
        },
      ],
      experimental: false,
      status: {
        hasCredentials: false,
        credentialType: null,
        selectedAuthMethod: null,
        expiresAt: null,
        status: 'disconnected',
      },
    },
    custom_openai: {
      title: 'OpenAI-compatible',
      kind: 'custom',
      baseUrl: 'https://api.example.com/v1',
      models: [{modelName: 'my-compatible-model'}],
      defaultAuthMethod: 'manual_api_key',
      authMethods: [
        {
          id: 'manual_api_key',
          type: 'api_key',
          label: 'Manually enter API Key',
          description:
            'Use this for self-hosted or third-party OpenAI-compatible APIs.',
          experimental: false,
          metadata: {},
        },
      ],
      experimental: false,
      status: {
        hasCredentials: false,
        credentialType: null,
        selectedAuthMethod: null,
        expiresAt: null,
        status: 'disconnected',
      },
    },
  },
};
