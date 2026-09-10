/**
 * Shared helpers for `xiaobao-cli date *`.
 */

import { defineCommand, type CommandDef } from 'citty';
import { DateInputError } from '../../core/date-util';
import { writeError, writeResult } from '../../output/format';

export const timezoneArg = {
  timezone: {
    type: 'string' as const,
    description: 'IANA 时区，默认 Asia/Shanghai（或 TZ 环境变量）',
  },
};

export function parsePositiveDays(raw: unknown, label = 'days'): number {
  if (raw === undefined || raw === '') {
    throw new DateInputError(`缺少 ${label}`);
  }
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 0) {
    throw new DateInputError(`${label} 须为非负整数: ${raw}`);
  }
  return days;
}

export function defineDateCommand(def: {
  name: string;
  description: string;
  args?: CommandDef['args'];
  run: (ctx: { args: Record<string, unknown> }) => unknown;
}): CommandDef {
  return defineCommand({
    meta: {
      name: def.name,
      description: def.description,
    },
    args: {
      format: { type: 'string' as const, default: 'toon', description: 'Stdout format: toon (default) / json / table' },
      ...timezoneArg,
      ...def.args,
    },
    async run({ args }) {
      const format = typeof args.format === 'string' ? args.format : undefined;
      try {
        writeResult(def.run({ args: args as Record<string, unknown> }), format);
      } catch (err) {
        writeError(err, format);
        process.exit(1);
      }
    },
  });
}
