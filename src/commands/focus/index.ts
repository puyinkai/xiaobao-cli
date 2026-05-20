import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'focus', description: '客户关注点标签分页查询' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
  },
});
