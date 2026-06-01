# SQLRooms Web App

Hosted SQLRooms app for browser-based data analysis. The first milestone opens
into a default unsaved workspace, prepares Neon-backed workspace persistence,
and documents the service setup needed for the later file, AI, and deployment
stages.

## Current Milestone

- TanStack Start app scaffolded in `apps/web-app`.
- `/` opens an unsaved workspace with a default worksheet.
- Neon Auth client is wired, but the app remains usable when auth env vars are
  absent.
- Drizzle schema covers workspaces, workspace members, worksheets, files,
  storage usage, and AI usage events.
- Authenticated workspace CRUD server functions are scaffolded.
- File upload, AI assistant tools, and real BlockDocument worksheet editing are
  intentionally left for later stages.

## Local Development

```bash
pnpm --filter sqlrooms-web-app install
pnpm --filter sqlrooms-web-app dev
```

The app defaults to port `3000`.

Useful scripts:

```bash
pnpm --filter sqlrooms-web-app typecheck
pnpm --filter sqlrooms-web-app build
pnpm --filter sqlrooms-web-app db:generate
pnpm --filter sqlrooms-web-app db:migrate
pnpm --filter sqlrooms-web-app deploy
```

## Environment Variables

Create `apps/web-app/.env.local` for local development.

```bash
DATABASE_URL=
NEON_AUTH_BASE_URL=
VITE_NEON_AUTH_BASE_URL=
NEON_AUTH_JWKS_URL=
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=SQLRooms
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ALLOWED_ORIGIN=http://localhost:3000
```

Keep secrets such as `DATABASE_URL`, `OPENROUTER_API_KEY`,
`R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` out of `wrangler.jsonc`. Public
configuration such as `APP_BASE_URL`, `OPENROUTER_SITE_URL`, and
`OPENROUTER_APP_NAME` can live in Wrangler vars.

## Neon Setup

1. Create a Neon project.
2. Enable Neon Auth for the project.
3. Copy the Postgres connection string into `DATABASE_URL`.
4. Copy the Neon Auth base URL into `NEON_AUTH_BASE_URL` and
   `VITE_NEON_AUTH_BASE_URL`.
5. Copy the Neon Auth JWKS URL into `NEON_AUTH_JWKS_URL`.
6. Run Drizzle migrations:

```bash
pnpm --filter sqlrooms-web-app db:generate
pnpm --filter sqlrooms-web-app db:migrate
```

The app domain tables reference Neon Auth user IDs through `owner_id` and
`user_id` text columns. `workspace_members` is included from the start so the
schema can grow into collaboration later.

The app does not create a claimable Neon database at dev-server startup.
Configure `DATABASE_URL` explicitly before running migrations or any persisted
workspace path.

## Cloudflare Setup

1. Create a Cloudflare Worker for the app.
2. Create a private R2 bucket for user files.
3. Create a preview R2 bucket for preview/local deploys.
4. Add the R2 binding to `wrangler.jsonc` as `USER_FILES_BUCKET`.
5. Create an R2 API token/credential pair that can generate S3-compatible
   presigned `PUT` URLs.
6. Configure R2 CORS to allow browser `PUT` uploads from the app origin.
7. Add production secrets:

```bash
wrangler secret put DATABASE_URL
wrangler secret put OPENROUTER_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

File object keys should use:

```txt
users/{userId}/workspaces/{workspaceId}/{fileId}.parquet
```

Uploads will use server-generated R2 presigned `PUT` URLs. Reads stay
Worker-mediated in v1 so authorization remains centralized and private R2
objects are not exposed directly.

## OpenRouter Setup

1. Create an OpenRouter API key.
2. Set `OPENROUTER_API_KEY` as a local env var and production secret.
3. Set `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME`.
4. Start with the same assistant quota shape as ChordShell:
   - free: 60 messages/day and $0.04/day user cost cap
   - future pro plan: 300 messages/day and $0.40/day user cost cap
   - app-level daily budget if carried over: $1.50/day

The first milestone only creates the schema and app structure for AI usage
tracking. Chat routes and worksheet tools come later.

## Staged Omissions

- No durable localStorage workspace store. Anonymous work is runtime-only until
  the user signs in and saves it.
- No file upload UI yet. The planned flow is: local DuckDB load, export Parquet,
  validate exported Parquet size, upload directly to R2 with a presigned `PUT`,
  finalize in Neon DB.
- No AI assistant route yet.
- No full BlockDocument worksheet editor yet. Worksheets should follow
  `apps/sqlrooms-cli-ui/src/workspace/WorksheetArtifact.tsx` and
  `@sqlrooms/documents` rather than notebook internals.
