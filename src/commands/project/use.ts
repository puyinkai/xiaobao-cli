/**
 * `xiaobao-cli project use` — persist active tenant/project to
 * ~/.xiaobao/active-project.json (mode 0600). Mirrors openclaw-xiaobao's
 * `xiaobao_switch_project` tool.
 */

import { defineCommand } from 'citty';
import { saveActiveProject } from '../../core/project-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: {
    name: 'use',
    description: '激活指定租户/项目（先用 `project list` 拿候选）',
  },
  args: {
    'tenant-id': { type: 'string', required: true, description: '租户 ID' },
    'tenant-name': { type: 'string', required: true, description: '租户显示名' },
    'project-id': { type: 'string', required: true, description: '项目 ID（estateId）' },
    'project-name': { type: 'string', required: true, description: '项目显示名' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const saved = await saveActiveProject({
        tenantId: args['tenant-id'],
        tenantName: args['tenant-name'],
        projectId: args['project-id'],
        projectName: args['project-name'],
      });
      writeResult(
        {
          success: true,
          activeProject: saved,
          message: `已切换到「${saved.tenantName} / ${saved.projectName}」`,
        },
        args.format,
      );
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
