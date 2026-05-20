import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: 'esm',
  target: 'node22',
  platform: 'node',
  clean: true,
  outDir: 'dist',
  dts: true,
  // citty 是 runtime API（在 dependencies），让 npm 装时拉进 node_modules；
  // 其它（@toon-format/toon 在 devDependencies）都 bundle 进 dist/cli.mjs，
  // npm publish 的包零运行时 npm dep 也能跑（与 openclaw-xiaobao 同款策略，
  // 见那边 0.1.23 修的 toon bundle bug）。
  deps: {
    neverBundle: [/^citty$/, /^node:/],
  },
});
