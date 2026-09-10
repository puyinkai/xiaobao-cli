import { getDateInfo } from '../../core/date-util';
import { defineDateCommand } from './shared';

export default defineDateCommand({
  name: 'weekday',
  description: '查询指定日期是星期几',
  args: {
    date: {
      type: 'string' as const,
      description: 'YYYY-MM-DD',
      required: true,
    },
  },
  run: ({ args }) => getDateInfo(args.date as string, args.timezone as string | undefined),
});
