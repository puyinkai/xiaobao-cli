import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'project', description: '查询 / 切换激活项目' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    use: () => import('./use').then((m) => m.default),
  },
});
