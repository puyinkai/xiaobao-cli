import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'audio', description: '录音元数据分页 / 单条文本查询' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    text: () => import('./text').then((m) => m.default),
  },
});
