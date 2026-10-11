import {defaultSchema} from 'rehype-sanitize';

export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'think-block'],
  attributes: {
    ...defaultSchema.attributes,
    'think-block': ['data-index'],
  },
};
