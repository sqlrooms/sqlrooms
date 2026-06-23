# Commands

> When: deciding whether a workspace action should be exposed through the room command registry.
> See also: [Architecture](architecture.md), [Adding Features](adding-features.md)

Commands are SQLRooms' durable product-action vocabulary. A command should describe an operation that a user, UI surface, AI agent, skill, MCP client, or future automation can invoke and audit in the same way.

## Eligibility

Use a command when an operation is a durable, user-visible workspace action. Good command candidates create, select, rename, update, move, delete, import, or commit something the workspace persists or exposes as product state. Commands should delegate to the owning slice or feature API instead of becoming a second state model.

Keep an operation as an AI tool when it is mainly a model/runtime affordance: reading context, planning, summarizing, validating an intermediate draft, or wrapping a package API for better model ergonomics. AI tools that perform durable writes should call commands where practical.

Keep an operation as a specialized agent when it needs a complex private loop, such as generate -> observe -> repair. The private loop does not need a command for each internal step, but committed durable writes at the boundary should be command-backed where practical.

Keep an operation as an internal slice method when it is a low-level implementation primitive, an invariant-preserving helper used by commands and UI, or a package-local operation that does not yet have stable product vocabulary.

Do not add agent-only command paths when the same capability belongs in the normal room command registry.

## Result Convention

Every mutating command should return a `RoomCommandResult` that is useful for humans, follow-up tools, and traces:

| Field | Convention |
| --- | --- |
| `message` | Short human-readable summary suitable for audit logs, chat transcripts, and developer traces. |
| `code` | Stable machine-readable outcome only when callers need to branch on a result, such as `unchanged`, `not-found`, or `validation-failed`. |
| `data` | Stable IDs and chosen defaults needed for follow-up calls, such as `artifactId`, `artifactType`, `blockId`, `panelId`, `tableName`, `title`, or selected default values. |
| `artifactTargetChange` | Include inside `data` when create/select commands should hand off chat context to a new or selected artifact. Avoid adding it to ordinary updates unless the command intentionally changes the chat target. |
| `error` | Concise failure message. Prefer validation before mutation for user-correctable input errors. |

Command metadata should stay accurate enough for discovery and safe execution: set `readOnly`, `idempotent`, `riskLevel`, and `requiresConfirmation` when relevant. Use `ui.hidden` for command-backed operations that should be available to agents or integrations but not ordinary palette browsing.

## Stage 1 Audit

This audit is intentionally narrow. It covers direct durable mutations named by the command layer implementation plan on top of the block-document AI refactor.

| Operation | Current path | Classification | Next stage |
| --- | --- | --- | --- |
| Generic block-document text/chart/block creation | `BlockDocumentAiAdapter.addBlock` in `packages/documents` tools, with the CLI adapter appending through `state.blockDocuments.appendBlocks` | Should become command-backed | Stage 2: route the adapter through `block-document.append-blocks` / `block-document.create-chart-block` while preserving the generic `BlockDocument` API boundary. |
| Block-document commands | `createBlockDocumentCommands` already exposes create/list/get and block append/insert/update/remove/move plus chart/stateful-block creation | Already a good command family, but result payloads need sharpening | Stage 2: add created/updated block IDs, block type, stateful block instance ID, and chosen title/caption/default data where relevant. |
| Dashboard table and panel mutations | `createDashboardAiAdapter` calls `mosaicDashboard.setSelectedTable`, `addPanel`, `updatePanel`, and `removePanel` directly | Should become commands | Stage 3: add reusable dashboard commands and let the AI adapter use them when a command adapter is available. |
| Workspace artifact create/select | CLI `createDashboardCommands` exposes `*.create-artifact` commands and `artifact.select` | Already a good command baseline | Keep as the model for result payloads and `artifactTargetChange`. |
| Workspace artifact rename | Topbar, worksheet title editor, sidebar tabs, and app-builder flows call `artifacts.renameArtifact` directly | Should become a command | Stage 4: add `artifact.rename` with validation, no-op result code, previous/new title data, and existing artifact-type `onRename` hooks preserved. |
| Workspace artifact delete/close/fork | Artifact slice has direct lifecycle methods; command coverage is not yet present in the CLI command set | Should become commands selectively | Stage 4 or later: add only product-stable lifecycle commands, using confirmation/risk metadata for destructive operations. |
| CLI worksheet dashboard/data-table/html-app/map block creation | Worksheet AI composition and direct worksheet map/local import flows create stateful blocks through block-document slice methods and feature-specific callbacks | Should become CLI commands | Stage 5: add CLI-owned worksheet commands that wrap lower-level block-document commands without moving worksheet product policy into shared packages. |
| Local file loading into worksheets | `useLocalFileLoader` loads tables, ensures a worksheet, and appends a data-table stateful block directly | Should become command-backed after worksheet block commands exist | Stage 5: keep file import/loading concerns separate, then route the worksheet block addition through the worksheet command. |
| HTML app undo/redo/restore | `createHtmlAppRevisionCommands` exposes command-backed history navigation | Already a good command family, but payloads should align with the convention | Stage 6: add stable codes and richer app/revision data if follow-up logic needs it. |
| HTML app committed source writes | `html_app_agent` calls `htmlApps.commitAppRevision` directly for generated and edited source | Command-backed but hidden from ordinary UI | Stage 6: add `html-app.write-revision` and `html-app.rename` for committed durable writes, while keeping the repair loop private. |

Remaining slice methods should stay direct until a durable product action needs to call them from multiple surfaces. The goal is a small, inspectable command vocabulary, not a command wrapper for every mutation helper.
