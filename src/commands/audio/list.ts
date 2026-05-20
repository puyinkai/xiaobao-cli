/**
 * `xiaobao-cli audio list` — page audio metadata via POST /ai-open/audio/page.
 *
 * Mirrors openclaw-xiaobao xiaobao_list_audio. Returns audio metadata only
 * (audioId / fileId / startTime / endTime / duration / sale info / fileUrl).
 * Transcript text comes from `xiaobao-cli audio text <audio-id>`.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, mergeUserIds, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '录音元数据分页查询（按时间范围 + 可选顾问过滤）' },
  args: {
    from: {
      type: 'string',
      required: true,
      description: '录音开始时间，yyyy-MM-dd HH:mm:ss（或 ISO，自动转换）',
    },
    to: {
      type: 'string',
      required: true,
      description: '录音结束时间，同 from 格式',
    },
    'user-id': { type: 'string', description: '单顾问 user-id 过滤' },
    'user-id-list': { type: 'string', description: 'CSV: u1,u2,u3 多顾问' },
    page: { type: 'string', default: '1' },
    size: { type: 'string', default: '10' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const active = await requireActiveProject();
      const mergedUserIds = mergeUserIds(args['user-id'], csvToArray(args['user-id-list']));
      const result = await xbApiFetch(config, 'POST', '/ai-open/audio/page', {
        headers: tenantProjectHeaders(active),
        body: {
          fromDate: toLocalDateTime(args.from),
          toDate: toLocalDateTime(args.to),
          userIdList: mergedUserIds,
          page: Number(args.page),
          size: Number(args.size),
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
