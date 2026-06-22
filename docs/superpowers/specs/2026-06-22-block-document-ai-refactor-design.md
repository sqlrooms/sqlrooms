# Block Document AI Refactor Design

**Date:** 2026-06-22  
**Status:** Approved  
**Approach:** Atomic migration with sequential execution

## Problem Statement

The AI functionality for worksheets is currently located in `packages/mosaic/src/ai/worksheet`, which creates several architectural issues:

1. **Wrong ownership**: `worksheet` is a CLI app artifact concept, not a Mosaic concept
2. **Mixed concerns**: Generic block-document logic is mixed with Mosaic-specific code
3. **Misplaced code**: HTML app code lives in Mosaic but belongs to `@sqlrooms/app-runtime`
4. **Leaked terminology**: The term "worksheet" has leaked into shared package APIs where it should be "BlockDocument"

This makes it appear that Mosaic owns the worksheet artifact and creates coupling between packages that should be independent.

## Goals

1. Move generic block-document AI primitives to `@sqlrooms/documents`
2. Move HTML app block construction to `@sqlrooms/app-runtime`
3. Keep only Mosaic-specific integrations in `@sqlrooms/mosaic`
4. Move worksheet artifact orchestration to `apps/sqlrooms-cli-ui`
5. Replace "Worksheet" terminology with "BlockDocument" in shared packages
6. Maintain "worksheet" terminology only in CLI app for user-facing artifacts

## Target Ownership Model

### `@sqlrooms/documents`

Owns generic block-document AI primitives:

- `BlockDocumentAiAdapter` — generic adapter interface
- Text block creation tool
- Block listing tool with generic stateful block summaries
- Generic types for results and extension tools

### `@sqlrooms/app-runtime`

Owns HTML app block construction:

- Pure helper: `createHtmlAppBlockDocumentBlock()`
- No AI dependencies — just block construction logic

### `@sqlrooms/mosaic`

Owns only Mosaic-specific block-document integrations:

- Chart block tools
- Dashboard block tool
- Data table explorer block tool

### `apps/sqlrooms-cli-ui`

Owns worksheet artifact orchestration:

- `worksheetAgentTool` — CLI-facing wrapper
- `createWorksheetAiAdapter` — worksheet-specific adapter implementation
- AI tool composition and integration
- Product-specific agent instructions
- HTML app AI tool wrapper

## Vocabulary Changes

Package APIs transition from `Worksheet*` to `BlockDocument*`:

| Old (Mosaic)               | New (Generic)                   |
| -------------------------- | ------------------------------- |
| `WorksheetAiAdapter`       | `BlockDocumentAiAdapter`        |
| `worksheetId`              | `blockDocumentId`               |
| `create_worksheet_block_*` | `create_block_document_chart_*` |
| `list_worksheet_blocks`    | `list_block_document_blocks`    |
| `add_text_block`           | `add_block_document_text_block` |

CLI app preserves `worksheet` terminology for user-facing artifacts and tool names.

## Architecture Changes

### 1. `@sqlrooms/documents` — New AI Structure

Create `packages/documents/src/ai/` with the following files:

#### `BlockDocumentAiAdapter.ts`

Generic adapter interface without Mosaic-specific methods:

```typescript
export type BlockDocumentAiAdapter = {
  /** Set the current active block document (optional) */
  setCurrentBlockDocument?(blockDocumentId: string): void;

  /** Ensure block document exists */
  ensureBlockDocument(blockDocumentId: string): void;

  /** Get block document's blocks */
  getBlocks(blockDocumentId: string): BlockDocumentNode[] | undefined;

  /** Add a block to the block document */
  addBlock(blockDocumentId: string, block: BlockDocumentBlock): string;
};
```

Key changes from `WorksheetAiAdapter`:

- Removed `addDashboardBlock()` — not a generic operation
- Removed `addDataTableExplorerBlock()` — not a generic operation
- Renamed `setCurrentWorksheet` → `setCurrentBlockDocument`
- Renamed `ensureWorksheet` → `ensureBlockDocument`

#### `blockDocumentAiTypes.ts`

Generic types moved from Mosaic:

```typescript
export type BlockDocumentAgentResult = {
  success: boolean;
  finalOutput: string;
  blockDocumentId: string;
  error?: string;
  metadata?: AgentResultMetadata;
};

export type ExtraBlockDocumentAiToolsParams = {
  blockDocumentId: string;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

export type ExtraBlockDocumentAiToolsFactory = (
  params: ExtraBlockDocumentAiToolsParams,
) => Record<string, Tool>;

export type BlockDocumentBlockSummary = {
  blockId: string;
  type: string;
  title?: string;
  caption?: string;
  tableName?: string;
  statefulBlock?: {
    blockType: string;
    blockInstanceId?: string;
    ownership?: 'owned' | 'external';
  };
};
```

Key changes:

- Generic `statefulBlock` summary instead of `dashboardId`/`htmlAppId`
- Renamed all `Worksheet*` types to `BlockDocument*`

#### `createAddBlockDocumentTextBlockTool.ts`

Moved from `mosaic/ai/worksheet/createAddTextBlockTool.ts`:

```typescript
export type CreateAddBlockDocumentTextBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

export function createAddBlockDocumentTextBlockTool(
  options: CreateAddBlockDocumentTextBlockToolOptions,
): Tool {
  // Implementation moved from Mosaic
  // Tool name: 'add_block_document_text_block'
}
```

Changes:

- Renamed parameters: `worksheetAdapter` → `blockDocumentAdapter`
- Renamed parameters: `worksheetId` → `blockDocumentId`
- Updated tool name: `add_text_block` → `add_block_document_text_block`

#### `createListBlockDocumentBlocksTool.ts`

Moved from `mosaic/ai/worksheet/createListWorksheetBlocksTool.ts`:

```typescript
export type CreateListBlockDocumentBlocksToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

export function createListBlockDocumentBlocksTool(
  options: CreateListBlockDocumentBlocksToolOptions,
): Tool {
  // Returns generic BlockDocumentBlockSummary[]
  // Tool name: 'list_block_document_blocks'
}
```

Changes:

- Renamed parameters to use `blockDocument` instead of `worksheet`
- Updated tool name: `list_worksheet_blocks` → `list_block_document_blocks`
- Generic stateful block summary (no hardcoded `dashboardId`/`htmlAppId`)

#### `constants.ts`

```typescript
export const BLOCK_DOCUMENT_TEXT_TOOL_NAME = 'add_block_document_text_block';
export const BLOCK_DOCUMENT_LIST_BLOCKS_TOOL_NAME =
  'list_block_document_blocks';
```

#### Exports

All new files exported through `packages/documents/src/index.ts` (no subpath exports).

### 2. `@sqlrooms/app-runtime` — HTML App Block Helper

Create `packages/app-runtime/src/html-app-blocks.ts`:

```typescript
export function createHtmlAppBlockDocumentBlock(options: {
  title: string;
  intent?: string;
  height?: number;
  appId?: string;
  blockId?: string;
}): {
  appId: string;
  block: BlockDocumentStatefulBlockBlock;
} {
  const appId = options.appId || createDefaultBlockDocumentBlockId();
  const blockId = options.blockId || createDefaultBlockDocumentBlockId();

  const block: BlockDocumentStatefulBlockBlock = {
    type: 'statefulBlock',
    id: blockId,
    blockInstanceId: appId,
    blockType: 'html-app',
    intent: options.intent,
    caption: options.title,
    height: options.height,
  };

  return {appId, block};
}
```

This is a pure helper with no AI SDK dependency. The logic is extracted from `mosaic/ai/worksheet/createAddHtmlAppBlockTool.ts`.

Export through `packages/app-runtime/src/index.ts`.

### 3. `@sqlrooms/mosaic` — Restructure to Block Document

#### Directory Rename

`packages/mosaic/src/ai/worksheet/` → `packages/mosaic/src/ai/block-document/`

#### Files to Move & Rename

**`createBlockDocumentChartTools.ts`** (was `createWorksheetChartTools.ts`)

```typescript
export type CreateBlockDocumentChartToolsParams = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  // ... other params
};

export function createBlockDocumentChartTools(
  params: CreateBlockDocumentChartToolsParams,
): Record<string, Tool> {
  // Tool prefix: 'create_block_document_chart_'
}
```

Changes:

- Renamed type: `CreateWorksheetChartToolsParams` → `CreateBlockDocumentChartToolsParams`
- Renamed parameters: `worksheetAdapter` → `blockDocumentAdapter`, `worksheetId` → `blockDocumentId`
- Updated tool prefix: `create_worksheet_block_` → `create_block_document_chart_`

**`createAddMosaicDashboardBlockTool.ts`** (was `createAddDashboardBlockTool.ts`)

```typescript
export type CreateAddMosaicDashboardBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => {dashboardId: string; block: BlockDocumentStatefulBlockBlock};
};

export function createAddMosaicDashboardBlockTool(
  options: CreateAddMosaicDashboardBlockToolOptions,
): Tool {
  // Tool name: 'add_mosaic_dashboard_block'
}
```

Changes:

- Dashboard creation moved out of generic adapter into callback parameter
- CLI app implements `createDashboardBlock` callback
- Uses generic `blockDocumentAdapter.addBlock()` instead of `worksheetAdapter.addDashboardBlock()`

**`createBlockDocumentDataTableExplorerTool.ts`** (was `createWorksheetDataTableExplorerTool.ts`)

```typescript
export type CreateBlockDocumentDataTableExplorerToolParams = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  // ... other params
};

export function createBlockDocumentDataTableExplorerTool(
  params: CreateBlockDocumentDataTableExplorerToolParams,
): Tool {
  // Tool name: 'add_data_table_explorer_block'
}
```

Changes:

- Renamed types to use `BlockDocument` prefix
- Replace `worksheetAdapter.addDataTableExplorerBlock()` with local block construction + `blockDocumentAdapter.addBlock()`

**`constants.ts`** (Mosaic-specific)

```typescript
export const BLOCK_DOCUMENT_CHART_TOOL_PREFIX = 'create_block_document_chart_';
export const ADD_MOSAIC_DASHBOARD_BLOCK_TOOL_NAME =
  'add_mosaic_dashboard_block';
export const ADD_DATA_TABLE_EXPLORER_BLOCK_TOOL_NAME =
  'add_data_table_explorer_block';
```

#### Files to Delete from Mosaic

These files are moved to other packages:

- `ai/worksheet/worksheet-types.ts` — types moved to `@sqlrooms/documents` and CLI
- `ai/worksheet/createAddTextBlockTool.ts` — moved to `@sqlrooms/documents`
- `ai/worksheet/createListWorksheetBlocksTool.ts` — moved to `@sqlrooms/documents`
- `ai/worksheet/createAddHtmlAppBlockTool.ts` — logic moved to app-runtime helper, AI wrapper moved to CLI
- `ai/worksheet/createWorksheetAiTools.ts` — orchestration moved to CLI
- `ai/worksheet/createWorksheetAgentTool.ts` — moved to CLI

#### Export Updates

**`packages/mosaic/src/ai.ts`** — Remove:

```typescript
export * from './ai/worksheet/worksheet-types';
export {createWorksheetAgentTool} from './ai/worksheet/createWorksheetAgentTool';
```

Add:

```typescript
export * from './ai/block-document/createBlockDocumentChartTools';
export * from './ai/block-document/createAddMosaicDashboardBlockTool';
export * from './ai/block-document/createBlockDocumentDataTableExplorerTool';
```

### 4. `apps/sqlrooms-cli-ui` — Worksheet Orchestration

#### New Files

**`src/ai/createAddHtmlAppBlockDocumentTool.ts`**

AI tool wrapper for HTML app blocks:

```typescript
import {createHtmlAppBlockDocumentBlock} from '@sqlrooms/app-runtime';
import {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import {tool} from 'ai';

export type CreateAddHtmlAppBlockDocumentToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
};

export function createAddHtmlAppBlockDocumentTool(
  options: CreateAddHtmlAppBlockDocumentToolOptions,
) {
  return tool({
    description: 'Create an HTML app block in the block document',
    parameters: z.object({
      title: z.string(),
      intent: z.string().optional(),
      height: z.number().optional(),
    }),
    execute: async ({title, intent, height}) => {
      const {appId, block} = createHtmlAppBlockDocumentBlock({
        title,
        intent,
        height,
      });

      const blockId = options.blockDocumentAdapter.addBlock(
        options.blockDocumentId,
        block,
      );

      return {
        success: true,
        blockId,
        appId,
        message: `Created HTML app block "${title}"`,
      };
    },
  });
}
```

**`src/ai/createWorksheetBlockDocumentTools.ts`**

Composes all tools for worksheet block documents:

```typescript
import {
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
  BlockDocumentAiAdapter,
} from '@sqlrooms/documents';
import {
  createBlockDocumentChartTools,
  createAddMosaicDashboardBlockTool,
  createBlockDocumentDataTableExplorerTool,
} from '@sqlrooms/mosaic/ai';
import {createAddHtmlAppBlockDocumentTool} from './createAddHtmlAppBlockDocumentTool';

export function createWorksheetBlockDocumentTools(params: {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  databaseAdapter: DatabaseAiAdapter;
  dashboardAgentTool: Tool;
  htmlAppAgentTool: Tool;
  chartToolsOptions: any;
  extraTools?: () => Record<string, Tool>;
}): Record<string, Tool> {
  return {
    // Generic document tools from @sqlrooms/documents
    ...createAddBlockDocumentTextBlockTool({
      blockDocumentAdapter: params.blockDocumentAdapter,
      blockDocumentId: params.blockDocumentId,
    }),
    ...createListBlockDocumentBlocksTool({
      blockDocumentAdapter: params.blockDocumentAdapter,
      blockDocumentId: params.blockDocumentId,
    }),

    // Mosaic tools from @sqlrooms/mosaic
    ...createBlockDocumentChartTools({
      blockDocumentAdapter: params.blockDocumentAdapter,
      blockDocumentId: params.blockDocumentId,
      ...params.chartToolsOptions,
    }),
    add_mosaic_dashboard_block: createAddMosaicDashboardBlockTool({...}),
    add_data_table_explorer: createBlockDocumentDataTableExplorerTool({...}),

    // HTML app tool (local)
    add_html_app_block: createAddHtmlAppBlockDocumentTool({
      blockDocumentAdapter: params.blockDocumentAdapter,
      blockDocumentId: params.blockDocumentId,
    }),

    // Embedded agents
    embedded_dashboard_agent: params.dashboardAgentTool,
    embedded_html_app_agent: params.htmlAppAgentTool,

    // Extra host tools
    ...(params.extraTools?.() || {}),
  };
}
```

**`src/ai/createWorksheetAgentTool.ts`**

Moved from `packages/mosaic/src/ai/worksheet/createWorksheetAgentTool.ts`:

```typescript
import {BlockDocumentAiAdapter} from '@sqlrooms/documents';
// ... implementation moved from Mosaic

// Still exposes tool name 'worksheet_agent' for UX
// But uses BlockDocumentAiAdapter internally
```

**`src/ai/constants.ts`**

CLI-specific constants:

```typescript
export const WORKSHEET_AGENT_TOOL_NAME = 'worksheet_agent';
export const EMBEDDED_DASHBOARD_AGENT_TOOL_NAME = 'embedded_dashboard_agent';
export const EMBEDDED_HTML_APP_AGENT_TOOL_NAME = 'embedded_html_app_agent';
```

#### Updated Files

**`src/createWorksheetAiAdapter.ts`**

Update to implement `BlockDocumentAiAdapter`:

```typescript
import {BlockDocumentAiAdapter} from '@sqlrooms/documents';
// Change from: import {WorksheetAiAdapter} from '@sqlrooms/mosaic/ai';

export function createWorksheetAiAdapter(
  store: StoreApi<RoomState>,
): BlockDocumentAiAdapter {
  // Remove addDashboardBlock and addDataTableExplorerBlock methods
  // Keep only generic adapter methods
  return {
    setCurrentBlockDocument: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),
    ensureBlockDocument,
    getBlocks,
    addBlock,
  };
}
```

**`src/createWorksheetAgent.ts`**

Update imports:

```typescript
// Change from:
// import {createWorksheetAgentTool} from '@sqlrooms/mosaic/ai';
// import type {CreateWorksheetAgentToolOptions} from '@sqlrooms/mosaic/ai';

// To:
import {createWorksheetAgentTool} from './ai/createWorksheetAgentTool';
import type {CreateWorksheetAgentToolOptions} from './ai/createWorksheetAgentTool';
import {BlockDocumentAiAdapter} from '@sqlrooms/documents';
```

## Test Migration Strategy

### Split `packages/mosaic/__tests__/worksheet-ai.test.ts`

The existing test file will be split by ownership:

#### `packages/documents/__tests__/block-document-ai.test.ts`

Tests for generic document functionality:

- Text block creation (heading, paragraph, list)
- Block listing with generic stateful block summaries
- `BlockDocumentAiAdapter` interface behavior
- Mock adapter implementation

#### `packages/app-runtime/__tests__/html-app-blocks.test.ts`

Tests for HTML app block construction:

- `createHtmlAppBlockDocumentBlock()` helper
- Block structure validation
- Default values and options handling

#### `packages/mosaic/__tests__/block-document-integration.test.ts`

Tests for Mosaic-specific functionality:

- Chart block creation tools
- Dashboard block tool (with mock callback)
- Data table explorer block tool
- Tool naming and prefixes

#### `apps/sqlrooms-cli-ui/__tests__/worksheet-agent.test.ts`

Tests for CLI orchestration (if CLI has test infrastructure):

- Worksheet agent tool
- Tool composition
- Worksheet adapter implementation
- Integration between all packages

### Test Strategy

- Each package tests only its own responsibilities
- Use mock adapters for isolation where appropriate
- Maintain existing coverage levels
- Add new tests for extracted helpers and interfaces

## Migration Execution Plan

### Sequential Migration Approach

The refactor will be executed atomically in a single PR, but following a logical sequence:

**Step 1: Create `@sqlrooms/documents` AI structure**

1. Create `packages/documents/src/ai/` directory
2. Add `BlockDocumentAiAdapter.ts` with generic interface
3. Add `blockDocumentAiTypes.ts` with generic types
4. Move and rename `createAddBlockDocumentTextBlockTool.ts` from Mosaic
5. Move and rename `createListBlockDocumentBlocksTool.ts` from Mosaic
6. Add `constants.ts` with tool names
7. Export all from `packages/documents/src/index.ts`
8. Create `packages/documents/__tests__/block-document-ai.test.ts`

**Step 2: Add HTML app helper to `@sqlrooms/app-runtime`**

1. Create `packages/app-runtime/src/html-app-blocks.ts`
2. Extract pure block construction logic from Mosaic's `createAddHtmlAppBlockTool.ts`
3. Export from `packages/app-runtime/src/index.ts`
4. Create `packages/app-runtime/__tests__/html-app-blocks.test.ts`

**Step 3: Restructure Mosaic**

1. Rename directory: `packages/mosaic/src/ai/worksheet/` → `ai/block-document/`
2. Rename and update `createBlockDocumentChartTools.ts`
3. Rename and update `createAddMosaicDashboardBlockTool.ts`
4. Rename and update `createBlockDocumentDataTableExplorerTool.ts`
5. Add Mosaic-specific `constants.ts`
6. Update `packages/mosaic/__tests__/block-document-integration.test.ts`

**Step 4: Move orchestration to CLI**

1. Create `apps/sqlrooms-cli-ui/src/ai/` directory
2. Create `createAddHtmlAppBlockDocumentTool.ts` (AI wrapper using app-runtime helper)
3. Move `createWorksheetAgentTool.ts` from Mosaic to CLI
4. Create `createWorksheetBlockDocumentTools.ts` for tool composition
5. Create `constants.ts` with CLI-specific constants
6. Update `createWorksheetAiAdapter.ts` to implement `BlockDocumentAiAdapter`
7. Update `createWorksheetAgent.ts` imports
8. Add CLI tests if test infrastructure exists

**Step 5: Cleanup**

1. Delete `packages/mosaic/src/ai/worksheet/` directory entirely
2. Update `packages/mosaic/src/ai.ts` exports
3. Update package READMEs:
   - `packages/documents/README.md` — document new AI exports
   - `packages/app-runtime/README.md` — document HTML app block helper
   - `packages/mosaic/README.md` — update to reflect block-document terminology
4. Run validation commands

### Validation Commands

After each step, verify:

```sh
pnpm --filter @sqlrooms/documents typecheck
pnpm --filter @sqlrooms/app-runtime typecheck
pnpm --filter @sqlrooms/mosaic typecheck
pnpm --filter sqlrooms-cli-ui typecheck
```

Final validation:

```sh
pnpm --filter @sqlrooms/documents test
pnpm --filter @sqlrooms/app-runtime test
pnpm --filter @sqlrooms/mosaic test
pnpm typecheck
pnpm build
```

## Decisions Made

1. **No deprecated aliases** — Clean break with immediate updates to all imports
2. **No backward-compatible tool names** — Update tool names immediately (`create_worksheet_block_*` → `create_block_document_chart_*`)
3. **AI folder in documents** — Create `src/ai/` folder but export through main index (no subpath exports)
4. **HTML app helper in app-runtime** — Pure helper without AI dependency; AI wrapper lives in CLI
5. **Atomic migration** — All changes in one PR with comprehensive testing before merge

## Success Criteria

1. All worksheet AI functionality works identically after refactor
2. Package ownership is clear and follows architectural principles
3. Shared packages use "BlockDocument" terminology exclusively
4. CLI app retains "worksheet" terminology for user-facing artifacts
5. All tests pass with maintained or improved coverage
6. TypeScript compilation succeeds across all packages
7. No deprecated code or aliases introduced

## Future Considerations

1. **Data Table Explorer extraction** — Consider moving Data Table Explorer to its own package if it grows beyond Mosaic
2. **AI export subpath** — If AI surface in documents grows significantly, consider `@sqlrooms/documents/ai` subpath export
3. **Generic block document agent** — Consider creating a minimal generic agent in documents if pattern emerges across multiple apps
4. **Tool name versioning** — If tool name changes break saved prompts/transcripts, consider versioning strategy for future changes
