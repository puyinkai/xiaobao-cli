/**
 * `xiaobao-cli quantum <metric>` — 旺小宝量子看板 / 预聚合 KPI 统计.
 *
 * 一个通用命令覆盖全部量子指标（visit / visit-ongoing / visit-realtime / follow /
 * job-performance / work-quality / visit-timer / usage-data / resistance-point /
 * speech-sale / demand-data / hot-words / risk / special-visit / month-report /
 * deal / intent / pin-talk / demand-card / rhetoric）。它们共用同一套入参，靠
 * `--view` / `--mode` 区分子视图。调 POST /ai-open/quantum/<metric>。
 *
 * 各指标支持哪些 view / 需要哪些参数，见 wangxiaobao-quantum-stats skill。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../core/api-client';
import { resolveConfig } from '../core/config';
import { requireActiveProject } from '../core/project-store';
import { csvToArray, toLocalDateTime } from '../core/util';
import { tenantProjectHeaders } from '../output/headers';
import { writeError, writeResult } from '../output/format';

const num = (v: string | undefined): number | undefined => (v != null ? Number(v) : undefined);
const numList = (v: string | undefined): number[] | undefined => csvToArray(v)?.map(Number);

export default defineCommand({
  meta: {
    name: 'quantum',
    description: '量子看板 / KPI 统计（metric 见 quantum-stats skill；--view/--mode 区分子视图）',
  },
  args: {
    metric: {
      type: 'positional',
      required: true,
      description: '指标端点：visit / deal / intent / pin-talk / demand-card / visit-timer 等',
    },
    view: { type: 'string', description: '视图：summary|rank|team|time|user|... 随 metric 而定' },
    mode: { type: 'string', description: '模式：page|count（visit-ongoing）、query|find（month-report）' },
    role: { type: 'string', description: '角色：consultant|manager（usage-data）' },
    agg: { type: 'string', description: '接访时长 metric：total|avg（visit-timer）' },
    from: { type: 'string', description: '开始时间（默认当天 00:00:00）' },
    to: { type: 'string', description: '结束时间（默认次日 00:00:00）' },
    'date-type': { type: 'string', description: 'day|week|month|year|total' },
    page: { type: 'string' },
    size: { type: 'string' },
    offset: { type: 'string' },
    'team-id': { type: 'string', description: '团队 ID（team 视图下钻）' },
    'time-type': { type: 'string' },
    'visit-type': { type: 'string', description: 'first|second|third_more|special|all' },
    'deal-status': { type: 'string', description: 'CSV: 成交状态列表（deal）' },
    'model-id': { type: 'string', description: '销讲/挖需模型 ID（pin-talk/demand-card）' },
    'dimension-id': { type: 'string', description: '维度 ID（view=dimension|speech 下钻）' },
    'speech-id': { type: 'string', description: '话术 ID（view=speech）' },
    config: { type: 'string', description: '卡片 config JSON（一般不传）' },
    'stat-dimension': { type: 'string', description: 'visit_times|customer_num、follow_times|customer_num' },
    'intent-dimension': { type: 'string', description: 'review|ai（intent）' },
    'risk-dimension': { type: 'string', description: 'all|effective|review|invalid（risk）' },
    'intent-level': { type: 'string', description: 'A|B|C|D|E（intent view=user|period）' },
    direction: { type: 'string', description: 'left|right（intent view=period 翻页）' },
    'interval-start': { type: 'string', description: '接访时长分桶起点分钟（visit-timer view=team|date 必填）' },
    'interval-end': { type: 'string', description: '接访时长分桶终点分钟（visit-timer view=team|date 必填）' },
    'usage-data-type': { type: 'string', description: 'usage-data rank 指标' },
    'user-ids': { type: 'string', description: 'CSV: 显式 userIds 数据范围' },
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
      const metric = String(args.metric);
      const result = await xbApiFetch(
        config,
        'POST',
        `/ai-open/quantum/${encodeURIComponent(metric)}`,
        {
          headers: tenantProjectHeaders(active),
          body: {
            view: args.view,
            mode: args.mode,
            role: args.role,
            metric: args.agg,
            startTime: toLocalDateTime(args.from),
            endTime: toLocalDateTime(args.to),
            dateType: args['date-type'],
            page: num(args.page),
            size: num(args.size),
            offset: num(args.offset),
            teamId: num(args['team-id']),
            timeType: args['time-type'],
            visitType: args['visit-type'],
            dealStatus: numList(args['deal-status']),
            modelId: num(args['model-id']),
            dimensionId: num(args['dimension-id']),
            speechId: num(args['speech-id']),
            config: args.config,
            statDimension: args['stat-dimension'],
            intentDimension: args['intent-dimension'],
            riskDimension: args['risk-dimension'],
            intentLevel: args['intent-level'],
            direction: args.direction,
            intervalStart: num(args['interval-start']),
            intervalEnd: num(args['interval-end']),
            usageDataType: args['usage-data-type'],
            userIds: numList(args['user-ids']),
          },
        },
      );
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
