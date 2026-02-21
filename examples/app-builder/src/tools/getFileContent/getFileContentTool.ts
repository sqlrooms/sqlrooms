import type {OpenAssistantTool} from '@openassistant/utils';
import z from 'zod';
import {StoreApi} from 'zustand';
import type {WebContainerSliceState} from '../../../../../packages/webcontainer/dist';
import {GetFileContentToolResult} from './GetFileContentToolResult';

export const GetFileContentToolParameters = z.object({
  path: z.string().describe('The path to the file'),
});
export type GetFileContentToolParameters = z.infer<
  typeof GetFileContentToolParameters
>;

export type GetFileContentToolLlmResult = {
  success: boolean;
  details: {
    content: string;
  };
};

export type GetFileContentToolAdditionalData = Record<string, never>;

export type GetFileContentToolContext = unknown;

export function createGetFileContentTool(
  store: StoreApi<WebContainerSliceState>,
): OpenAssistantTool<
  typeof GetFileContentToolParameters,
  GetFileContentToolLlmResult,
  GetFileContentToolAdditionalData,
  GetFileContentToolContext
> {
  return {
    name: 'getFileContent',
    description: 'Get the content of a file',
    parameters: GetFileContentToolParameters,
    execute: async ({path}: GetFileContentToolParameters) => {
      const content = await store.getState().webcontainer.getFileContent(path);
      return {
        llmResult: {
          success: true,
          details: {
            path,
            content,
          },
        },
      };
    },
    component: GetFileContentToolResult,
  };
}
