import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'consultant', description: '查询有权限的置业顾问列表' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
  },
});
