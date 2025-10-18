export const AI_SETTINGS = {
  providers: {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        {
          id: 'gpt-4.1',
          modelName: 'gpt-4.1',
        },
        {
          id: 'gpt-4.1-mini',
          modelName: 'gpt-4.1-mini',
        },
        {
          id: 'gpt-4.1-nano',
          modelName: 'gpt-4.1-nano',
        },
        {
          id: 'gpt-4o',
          modelName: 'gpt-4o',
        },
        {
          id: 'gpt-4o-mini',
          modelName: 'gpt-4o-mini',
        },
        {
          id: 'gpt-5',
          modelName: 'gpt-5',
        },
      ],
    },
  },
};
