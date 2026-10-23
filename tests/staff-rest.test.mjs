import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decode } from '@toon-format/toon';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url));
const preload = fileURLToPath(new URL('./fixtures/staff-config.mjs', import.meta.url));
const tools = [{ name: 'staff-permission-scope', inputSchema: { type: 'object' } }, { name: 'staff-receptions' }];
const payload = { code: '0', msg: 'succeeded', data: { employee_id: '700525516968431616', total: 5 } };
let fixtureDir, server, base, requests, response;

before(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), 'staff-cli-'));
  await mkdir(join(fixtureDir, '.xiaobao'));
  await writeFile(join(fixtureDir, '.xiaobao/token.json'), JSON.stringify({
    access_token: 'opaque-test-token', token_type: 'Bearer', expires_at: Date.now() + 3600000,
  }));
  await writeFile(join(fixtureDir, '.xiaobao/active-project.json'), JSON.stringify({
    tenantId: '100', tenantName: '测试租户', projectId: '200', projectName: '测试项目',
  }));
  server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
    const out = response(req);
    res.writeHead(out.status ?? 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  requests = [];
  response = (req) => ({ body: { code: '0', data: req.method === 'GET' ? { tools } : { isError: false, payload } } });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(fixtureDir, { recursive: true, force: true });
});

async function staff(...args) {
  try {
    const result = await run(process.execPath, ['--import', preload, cli, 'staff', ...args, '--api-base', base], {
      env: { ...process.env, STAFF_CLI_TEST_DIR: fixtureDir }, timeout: 10000,
    });
    return { ...result, code: 0 };
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
  }
}

test('list uses ai-open REST and the normal project context with an opaque bearer token', async () => {
  const result = await staff('list');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { tools });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].url, '/ai-open/staff/tools');
  assert.equal(requests[0].headers.authorization, 'Bearer opaque-test-token');
  assert.equal(requests[0].headers['x-tenant-id'], '100');
  assert.equal(requests[0].headers['x-project-id'], '200');
  assert.equal(decodeURIComponent(requests[0].headers['x-project-name']), '测试项目');
  assert.equal(requests[0].headers['x-mcp-user-id'], undefined);
  assert.equal(requests[0].headers['x-mcp-tenant-id'], undefined);
});

test('call preserves variables, time flags, long IDs and the original business payload', async () => {
  const variables = { staff_user_id: '700525516968431616', page: 2 };
  const result = await staff('call', 'staff-receptions', '--variables', JSON.stringify(variables),
    '--time-start', '2026-10-01 00:00:00', '--time-end', '2026-10-20 23:59:59');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), payload);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, 'POST');
  assert.equal(requests[1].url, '/ai-open/staff/tools/staff-receptions/call');
  assert.deepEqual(requests[1].body, { variables, timeRange: { start: '2026-10-01 00:00:00', end: '2026-10-20 23:59:59' } });
});

test('permission call sends an empty variable object and supports TOON output', async () => {
  const result = await staff('call', 'staff-permission-scope', '--format', 'toon');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(decode(result.stdout), payload);
  assert.deepEqual(requests[1].body, { variables: {} });
});

test('tool failure exits nonzero and preserves the application error details', async () => {
  const error = { code: 'EMPLOYEE_SCOPE_VIOLATION', msg: 'outside scope' };
  const normal = response;
  response = (req) => req.method === 'GET' ? normal(req) : { body: { code: '0', data: { isError: true, payload: error } } };
  const result = await staff('call', 'staff-receptions');
  assert.equal(result.code, 1);
  assert.deepEqual(JSON.parse(result.stdout), { error: 'STAFF_TOOL_ERROR', message: 'outside scope', details: error });
});

test('ai-open whitelist guidance is an access error even when the Result code is zero', async () => {
  response = () => ({ body: { code: '0', data: '不在白名单中' } });
  const result = await staff('list');
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error, 'ACCESS_DENIED');
});

test('HTTP and malformed transport responses cannot appear as successful business data', async () => {
  response = () => ({ status: 503, body: { code: 'DOWN', msg: 'unavailable' } });
  let result = await staff('list');
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).status, 503);
  const normal = (req) => ({ body: { code: '0', data: req.method === 'GET' ? { tools } : { payload } } });
  response = normal;
  result = await staff('call', 'staff-receptions');
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error, 'INVALID_API_RESPONSE');
});

test('invalid variables fail locally and unopened tools are never called', async () => {
  let result = await staff('call', 'staff-receptions', '--variables', '[]');
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error, 'INVALID_VARIABLES');
  assert.equal(requests.length, 0);
  result = await staff('call', 'staff-voice-transcript');
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).error, 'STAFF_TOOL_NOT_FOUND');
  assert.equal(requests.length, 1);
});
