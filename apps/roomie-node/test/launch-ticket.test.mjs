import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {launchTicket} from './launch-ticket.mjs';

// Native startup competes with the full workspace test suite in CI. This tests
// authentication/reopen semantics, not a fifteen-second startup latency target.
test(
  'normal launch and reopen print fresh single-use tickets without seed or owner credentials',
  {timeout: 150000},
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'roomie-launch-'));
    let previous;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const child = spawn(process.execPath, ['test/live-m2.mjs'], {
          cwd: new URL('..', import.meta.url),
          env: {...process.env, ROOMIE_M2_DIRECTORY: directory},
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        let errors = '';
        child.stderr.on('data', (chunk) => {
          errors += chunk;
        });
        const exited = new Promise((resolve) => child.once('exit', resolve));
        try {
          const url = await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`Launch timed out: ${errors}`)),
              60000,
            );
            child.once('exit', () => {
              clearTimeout(timer);
              reject(new Error(`Host exited: ${errors}`));
            });
            child.stdout.on('data', (chunk) => {
              output += chunk;
              const match = output.match(
                /Browser sign-in .*: (http:\/\/[^\s]+)/,
              );
              if (match) {
                clearTimeout(timer);
                resolve(match[1]);
              }
            });
          });
          const control = JSON.parse(
            await readFile(join(directory, 'control.json'), 'utf8'),
          );
          const {token} = JSON.parse(
            await readFile(control.credentialPath, 'utf8'),
          );
          assert.ok(!output.includes(token));
          assert.ok(!url.includes(token));
          assert.notEqual(url, previous);
          previous = url;
          const ticket = new URLSearchParams(new URL(url).hash.slice(1)).get(
            'sqlrooms-ticket',
          );
          const exchange = () =>
            fetch(`${control.url}/api/auth/exchange`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Origin: control.url,
              },
              body: JSON.stringify({ticket}),
            });
          assert.equal((await exchange()).status, 200);
          assert.equal((await exchange()).status, 401);
          const renewed = await launchTicket(control);
          assert.notEqual(renewed, url);
          assert.ok(!renewed.includes(token));
          const content = await fetch(`${control.url}/api/content`, {
            headers: {Authorization: `Bearer ${token}`},
          }).then((r) => r.json());
          assert.equal(
            Object.keys(content.content.blockDocuments.artifacts).length,
            0,
          );
        } finally {
          child.kill('SIGTERM');
          await exited;
        }
      }
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  },
);
