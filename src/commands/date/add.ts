import { addDays, DateInputError } from '../../core/date-util';
import { defineDateCommand, parsePositiveDays } from './shared';

export default defineDateCommand({
  name: 'add',
  description: '日期往后推 N 天',
  args: {
    date: {
      type: 'positional',
      required: true,
      description: '基准日期 YYYY-MM-DD',
    },
    days: {
      type: 'positional',
      required: true,
      description: '往后推的天数（非负整数）',
    },
  },
  run: ({ args }) =>
    addDays(
      args.date as string,
      parsePositiveDays(args.days, 'days'),
      args.timezone as string | undefined,
    ),
});
