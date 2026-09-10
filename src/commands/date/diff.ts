import { dateDiff } from '../../core/date-util';
import { defineDateCommand } from './shared';

export default defineDateCommand({
  name: 'diff',
  description: '计算两日期相差天数（end - start）',
  args: {
    start: {
      type: 'string' as const,
      description: '开始日期 YYYY-MM-DD',
      required: true,
    },
    end: {
      type: 'string' as const,
      description: '结束日期 YYYY-MM-DD',
      required: true,
    },
  },
  run: ({ args }) => dateDiff(args.start as string, args.end as string),
});
