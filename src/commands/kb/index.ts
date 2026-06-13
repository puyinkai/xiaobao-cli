import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'kb',
    description: '项目知识库：语义检索 / 文档列表 / 文档详情 / 文档正文分页',
  },
  subCommands: {
    search: () => import('./search').then((m) => m.default),
    docs: () => import('./docs').then((m) => m.default),
    doc: () => import('./doc').then((m) => m.default),
    'doc-content': () => import('./doc-content').then((m) => m.default),
  },
});
