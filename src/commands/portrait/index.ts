import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'portrait',
    description: '客户画像分布：字段清单(list) / 单字段饼图(get)（按画像筛客户用 customer list --portrait）',
  },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    get: () => import('./get').then((m) => m.default),
  },
});
