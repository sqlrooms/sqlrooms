# SQLRooms Web App

Hosted SQLRooms app for browser-based data analysis. It opens into a default
unsaved workspace, initializes an ephemeral in-browser SQL runtime per
workspace, and persists authenticated workspaces, worksheets, normalized
Parquet files, and assistant usage through Neon/Cloudflare/OpenRouter.

## Current Milestone

- TanStack Start app scaffolded in `apps/web-app`.
- `/` opens an unsaved workspace with a default worksheet.
- Neon Auth client is wired, but the app remains usable when auth env vars are
  absent.
- Drizzle schema covers workspaces, workspace members, worksheets, files,
  storage usage, and AI usage events.
- Authenticated workspace CRUD server functions are scaffolded.
- Workspace file ingestion loads source files locally, exports Parquet, uploads
  directly to private R2 with presigned `PUT` URLs, and reloads saved files
  through Worker-authorized reads.
- Worksheets use `@sqlrooms/documents` `BlockDocument` with query, dashboard,
  data table, and chart block scaffolds.
- The assistant calls OpenRouter from a server route and records token usage in
  `ai_usage_events`.

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
OPENROUTER_MODEL=openai/gpt-4o-mini
AI_DAILY_MESSAGE_LIMIT=60
R2_ACCOUNT_ID=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ALLOWED_ORIGIN=http://localhost:3000
```

Keep secrets such as `DATABASE_URL`, `OPENROUTER_API_KEY`,
`R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` out of `wrangler.jsonc`. Public
configuration such as `APP_BASE_URL`, `OPENROUTER_SITE_URL`,
`OPENROUTER_APP_NAME`, `OPENROUTER_MODEL`, `AI_DAILY_MESSAGE_LIMIT`,
`R2_ACCOUNT_ID`, and `R2_BUCKET_NAME` can live in Wrangler vars.

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

1. Confirm Wrangler can see the configured account:

```bash
npx wrangler whoami
```

If Wrangler cannot infer the account from the token, keep `account_id` in
`wrangler.jsonc` or set `CLOUDFLARE_ACCOUNT_ID`.

2. Create a Cloudflare Worker for the app.
3. Create a private R2 bucket named `sqlrooms-user-files`.
4. Create a preview R2 bucket named `sqlrooms-user-files-preview`.
5. Add the R2 binding to `wrangler.jsonc` as `USER_FILES_BUCKET`.
6. Create an R2 API token/credential pair that can generate S3-compatible
   presigned `PUT` URLs.
7. Configure R2 CORS to allow browser `PUT` uploads from the app origin:

```json
[
  {
    "AllowedOrigins": ["https://your-sqlrooms-domain.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 300
  }
]
```

8. Add production secrets:

```bash
wrangler secret put DATABASE_URL
wrangler secret put OPENROUTER_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

9. Add production vars in `wrangler.jsonc` or the Cloudflare dashboard:
   `APP_BASE_URL`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_BASE_URL`,
   `NEON_AUTH_JWKS_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`,
   `OPENROUTER_MODEL`, `AI_DAILY_MESSAGE_LIMIT`, `R2_ACCOUNT_ID`, and
   `R2_BUCKET_NAME`.

10. Build and deploy:

```bash
pnpm --filter sqlrooms-web-app build
pnpm --filter sqlrooms-web-app deploy
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
3. Set `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, and
   `OPENROUTER_MODEL`.
4. Start with the same assistant quota shape as ChordShell:
   - free: 60 messages/day and $0.04/day user cost cap
   - future pro plan: 300 messages/day and $0.40/day user cost cap
   - app-level daily budget if carried over: $1.50/day

The current assistant route enforces the 60-message daily limit through
`AI_DAILY_MESSAGE_LIMIT` and records token usage. Cost caps still need
provider-pricing metadata before they can be enforced precisely.

## Deployment Status

`pnpm --filter sqlrooms-web-app build` passes locally. In this development
environment, `npx wrangler whoami` reaches Wrangler but still cannot infer
account IDs from the active token/session, even with `account_id` present in
`wrangler.jsonc`. Actual production deploy still requires a Wrangler token with
the right account permissions, real Neon Auth URLs, `DATABASE_URL`,
OpenRouter key, R2 credentials, and final app/domain values.

## Staged Omissions

- No durable localStorage workspace store. Anonymous work is runtime-only until
  the user signs in and saves it.
- File reads are Worker-mediated and currently stream full objects; byte-range
  handling still needs to be added before large Parquet restores.
- Worksheet blocks are persisted `BlockDocument` scaffolds. Query execution,
  data-table rendering, Mosaic charts, and dashboard composition still need the
  next implementation pass.
- The assistant is context-aware and usage-tracked, but it does not yet mutate
  worksheet blocks through normal UI commands.
- Storage quota reconciliation, orphan R2 cleanup, delete flows, and usage
  meters are not implemented yet.
