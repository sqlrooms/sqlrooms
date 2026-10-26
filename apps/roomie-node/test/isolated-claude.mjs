#!/usr/bin/env node
// Real pinned CLI, synthetic API key and a credential-free local model fixture.
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const {url} = JSON.parse(readFileSync('/work/provider.json', 'utf8'));
const child = spawn('claude', process.argv.slice(2), {
  stdio: 'inherit',
  env: {
    ...process.env,
    ANTHROPIC_BASE_URL: new URL(url).origin,
    ANTHROPIC_API_KEY: 'roomie-synthetic-fixture-key',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_AUTOUPDATER: '1',
  },
});
child.once('error', () => process.exit(1));
child.once('exit', (code) => process.exit(code ?? 1));
