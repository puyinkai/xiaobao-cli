import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'visit', description: '客户来访分页查询 / 来访接待总结' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    summary: () => import('./summary').then((m) => m.default),
  },
});
