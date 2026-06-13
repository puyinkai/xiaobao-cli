/**
 * `xiaobao-cli audio text <audio-id>` — fetch a single recording's transcript
 * via GET /ai-open/audio/text/{audioId}.
 *
 * Returns talkRatios (per-speaker speaking ratios) + texts (segmented ASR
 * with role / beginTime / endTime / text / commentaryNum per item).
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: {
    name: 'text',
    description: '查询单条录音转录文本（含说话人占比 + 分段文本）',
  },
  args: {
    audioId: {
      type: 'positional',
      required: true,
      description: '录音 ID（来自 audio list 的 content[].audioId）',
    },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const active = await requireActiveProject();
      const audioId = String(args.audioId);
      const result = await xbApiFetch(
        config,
        'GET',
        `/ai-open/audio/text/${encodeURIComponent(audioId)}`,
        { headers: tenantProjectHeaders(active) },
      );
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
