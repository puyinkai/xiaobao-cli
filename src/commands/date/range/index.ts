import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'range',
    description:
      '算出业务查询用的 from/to（含时分秒）；不查数据，只生成时间参数给 quantum / list',
  },
  subCommands: {
    today: () => import('./today').then((m) => m.default),
    yesterday: () => import('./yesterday').then((m) => m.default),
    'this-week': () => import('./this-week').then((m) => m.default),
    'this-month': () => import('./this-month').then((m) => m.default),
    'last-7-days': () => import('./last-7-days').then((m) => m.default),
    'today-so-far': () => import('./today-so-far').then((m) => m.default),
  },
});
