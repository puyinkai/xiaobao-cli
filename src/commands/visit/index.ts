import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'visit', description: '客户来访分页查询' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
  },
});
