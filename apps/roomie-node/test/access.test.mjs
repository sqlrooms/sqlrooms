import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWorkspaceAccess} from '../src/access.ts';

test('ticket/page expiry, revocation, binding isolation and shutdown fail closed', () => {
  let now = 0;
  const access = createWorkspaceAccess({
    clock: () => now,
    ticketTtlMs: 10,
    pageTtlMs: 20,
  });
  const ticket = access.ticket();
  now = 10;
  assert.throws(() => access.redeem(ticket), /unauthorized/);
  const page = access.redeem(access.ticket());
  now = 29;
  assert.equal(access.renew(page.token).expiresAt, 0.049);
  now = 49;
  assert.throws(() => access.renew(page.token), /unauthorized/);
  assert.throws(
    () => access.verify(createWorkspaceAccess().ownerToken, 'mcp'),
    /unauthorized/,
  );
  const fresh = access.redeem(access.ticket());
  access.revoke(fresh.token);
  assert.throws(() => access.renew(fresh.token), /unauthorized/);
  const unused = access.ticket();
  access.close();
  assert.throws(() => access.verify(access.ownerToken, 'mcp'), /unauthorized/);
  assert.throws(() => access.redeem(unused), /unauthorized/);
  assert.throws(() => access.ticket(), /unauthorized/);
});

test('outstanding bootstrap tickets are bounded and expired tickets release capacity', () => {
  let now = 0;
  const access = createWorkspaceAccess({clock: () => now, ticketTtlMs: 10});
  for (let i = 0; i < 64; i++) access.ticket();
  assert.throws(() => access.ticket(), /too_many_tickets/);
  now = 10;
  assert.equal(typeof access.ticket(), 'string');
});

test('gateway browser sessions retain page-only scope, expiry and bounded issuance', () => {
  let now = 0;
  const access = createWorkspaceAccess({clock: () => now, pageTtlMs: 10});
  const page = access.issueBrowser();
  access.verify(page.token, 'edit');
  access.verify(page.token, 'runs');
  assert.throws(() => access.verify(page.token, 'mcp'), /forbidden/);
  assert.throws(() => access.verify(page.token, 'bootstrap'), /forbidden/);
  for (let i = 1; i < 256; i++) access.issueBrowser();
  assert.throws(() => access.issueBrowser(), /too_many_sessions/);
  now = 10;
  assert.throws(() => access.verify(page.token, 'view'), /unauthorized/);
  access.issueBrowser();
  access.close();
  assert.throws(() => access.issueBrowser(), /unauthorized/);
});
