#!/usr/bin/env node
/**
 * xiaobao-cli entrypoint.
 *
 * Capabilities mapped from the openclaw-xiaobao plugin to CLI subcommands,
 * plus visit-summary and knowledge-base queries — all proxied through
 * ai-open → wang-ai-mcp. See README for the full command map.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCommand, runMain } from 'citty';

// Read package.json at runtime so version stays in sync with the single source
// of truth (package.json), no manual dual-bump on each release.
const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

const main = defineCommand({
  meta: {
    name: 'xiaobao-cli',
    version: pkg.version,
    description:
      '旺小宝 CLI — host-agnostic 业务数据 / 问数 / 来访总结 / 知识库 能力 (openclaw-xiaobao plugin 的 CLI 等价物)',
  },
  subCommands: {
    auth: () => import('./commands/auth/index').then((m) => m.default),
    project: () => import('./commands/project/index').then((m) => m.default),
    consultant: () => import('./commands/consultant/index').then((m) => m.default),
    audio: () => import('./commands/audio/index').then((m) => m.default),
    customer: () => import('./commands/customer/index').then((m) => m.default),
    visit: () => import('./commands/visit/index').then((m) => m.default),
    focus: () => import('./commands/focus/index').then((m) => m.default),
    resistance: () => import('./commands/resistance/index').then((m) => m.default),
    qa: () => import('./commands/qa').then((m) => m.default),
    kb: () => import('./commands/kb/index').then((m) => m.default),
    api: () => import('./commands/api').then((m) => m.default),
  },
});

runMain(main);
