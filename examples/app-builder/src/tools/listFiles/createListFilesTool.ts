import z from 'zod';
import {StoreApi} from 'zustand';
import {fileSystemTreeToNodes} from '../../components/filetree/fileSystemTreeToNodes';
import {WebContainerSliceState} from '../../store/WebContainerSlice';
import {ListFilesToolResult} from './ListFilesToolResult';
import {AiSliceTool} from '@sqlrooms/ai-core';

export function createListFilesTool(
  store: StoreApi<WebContainerSliceState>,
): AiSliceTool {
  return {
    description: 'List project files',
    parameters: z.object({
      basePath: z
        .string()
        .describe('Optional base path to list files from')
        .default('/'),
    }),
    execute: async ({basePath = '/'}: {basePath?: string}) => {
      return {
        llmResult: {
          success: true,
          details: fileSystemTreeToNodes(
            store.getState().wc.filesTree,
            basePath,
          ),
        },
      };
    },
    component: ListFilesToolResult,
  };
}
