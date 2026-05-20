import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'resistance', description: '客户抗性点标签分页查询' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
  },
});
