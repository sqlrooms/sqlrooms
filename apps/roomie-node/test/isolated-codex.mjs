#!/usr/bin/env node
// Native Codex with a credential-free local model endpoint for deterministic CI.
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const {url} = JSON.parse(readFileSync('/work/provider.json', 'utf8'));
const child = spawn(
  'codex',
  [
    ...process.argv.slice(2),
    '-c',
    'model_provider="roomie-test"',
    '-c',
    'model_providers.roomie-test.name="Roomie test"',
    '-c',
    `model_providers.roomie-test.base_url=${JSON.stringify(url)}`,
    '-c',
    'model_providers.roomie-test.wire_api="responses"',
    '-c',
    'model_providers.roomie-test.requires_openai_auth=false',
  ],
  {stdio: 'inherit'},
);
child.on('error', () => process.exit(1));
child.on('exit', (code) => process.exit(code ?? 1));
