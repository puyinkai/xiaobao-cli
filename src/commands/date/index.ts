import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'date',
    description: '本地日期/时间（不走 MCP）：now、today、weekday、range 等',
  },
  subCommands: {
    now: () => import('./now').then((m) => m.default),
    today: () => import('./today').then((m) => m.default),
    yesterday: () => import('./yesterday').then((m) => m.default),
    tomorrow: () => import('./tomorrow').then((m) => m.default),
    weekday: () => import('./weekday').then((m) => m.default),
    add: () => import('./add').then((m) => m.default),
    subtract: () => import('./subtract').then((m) => m.default),
    diff: () => import('./diff').then((m) => m.default),
    range: () => import('./range/index').then((m) => m.default),
  },
});
