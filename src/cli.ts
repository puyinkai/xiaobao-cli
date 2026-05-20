#!/usr/bin/env node
/**
 * xiaobao-cli entrypoint.
 *
 * 14 capabilities mapped 1:1 from openclaw-xiaobao plugin tools to CLI
 * subcommands. See README for full command map.
 */

import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'xiaobao-cli',
    version: '0.1.0',
    description:
      '旺小宝 CLI — host-agnostic 14 tools (openclaw-xiaobao plugin 的 CLI 等价物)',
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
    api: () => import('./commands/api').then((m) => m.default),
  },
});

runMain(main);
