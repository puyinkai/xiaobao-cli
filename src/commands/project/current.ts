/**
 * `xiaobao-cli project current` — show the currently active project.
 *
 * Reads ~/.xiaobao/active-project.json (or fallback
 * ~/.openclaw/state/wangxiaobao/active-project.json) and prints the
 * tenant/project record. If none is set, errors out with NO_ACTIVE_PROJECT
 * + hint (same error shape as other commands that need an active project,
 * so agents handle it uniformly).
 */

import { defineCommand } from 'citty';
import { requireActiveProject } from '../../core/project-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'current', description: '显示当前激活的租户/项目' },
  args: {
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const active = await requireActiveProject();
      writeResult(active, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
