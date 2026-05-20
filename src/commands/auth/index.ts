import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'auth',
    description: 'OAuth 登录 / 身份查询 / 登出（device flow）',
  },
  subCommands: {
    login: () => import('./login').then((m) => m.default),
    whoami: () => import('./whoami').then((m) => m.default),
    logout: () => import('./logout').then((m) => m.default),
  },
});
