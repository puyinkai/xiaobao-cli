import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'admin',
    description: 'super-admin 经营报表：公司经营数据（出库/回款）/ LLM token 用量（独立白名单）',
  },
  subCommands: {
    'sales-report': () => import('./sales-report').then((m) => m.default),
    'token-usage': () => import('./token-usage').then((m) => m.default),
  },
});
