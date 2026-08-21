# SQLRooms Eval Observatory

Read-only browser view for retained SQLRooms behavioral eval history. It loads
portable summaries produced by:

```sh
pnpm build
pnpm evals:export --database /path/to/promptfoo.db --output /tmp/summary.json
pnpm --filter sqlrooms-eval-observatory dev
```

The Node adapter opens Promptfoo SQLite files read-only and normalizes their
schema before this app sees any data. The browser can load multiple retained CI
summaries and requires no central service.
