Browser and backend-backed provider connect/auth state and UI for SQLRooms.

This package owns:

- transient connect/auth workflow state via `createAiConnectSlice()`
- reusable connect UI components like `AiConnectDialog`
- pluggable auth clients for browser-only and HTTP-backed apps
- credential storage interfaces for browser apps

Secrets and tokens belong here, not in `@sqlrooms/ai-settings`.
