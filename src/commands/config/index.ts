import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'config',
    description: '项目配置：客户字段配置(fields，解读 dynamic_tags 标签含义)',
  },
  subCommands: {
    fields: () => import('./fields').then((m) => m.default),
  },
});
