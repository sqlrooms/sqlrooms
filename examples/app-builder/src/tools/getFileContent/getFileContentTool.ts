import type {WebContainerSliceState} from '@sqlrooms/webcontainer';
import {tool} from 'ai';
import z from 'zod';
import {StoreApi} from 'zustand';
import {GetFileContentToolResult} from './GetFileContentToolResult';

export const GetFileContentToolParameters = z.object({
  path: z.string().describe('The path to the file'),
});
export type GetFileContentToolParameters = z.infer<
  typeof GetFileContentToolParameters
>;

export type GetFileContentToolOutput = {
  success: boolean;
  details: {
    path: string;
    content: string;
  };
};

export function createGetFileContentTool(
  store: StoreApi<WebContainerSliceState>,
) {
  return tool({
    description: 'Get the content of a file',
    inputSchema: GetFileContentToolParameters,
    execute: async ({path}) => {
      const content = await store.getState().webContainer.getFileContent(path);
      return {
        success: true,
        details: {
          path,
          content,
        },
      };
    },
  });
}

export const getFileContentToolRenderer = GetFileContentToolResult;
