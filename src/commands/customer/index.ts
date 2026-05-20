import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'customer', description: '客户画像分页查询' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
  },
});
