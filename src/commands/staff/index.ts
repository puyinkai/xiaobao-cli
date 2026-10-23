import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'staff', description: '查看和调用员工工具' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    call: () => import('./call').then((m) => m.default),
  },
});
