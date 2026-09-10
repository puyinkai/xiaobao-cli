import { getRelativeDay } from '../../core/date-util';
import { defineDateCommand } from './shared';

export default defineDateCommand({
  name: 'today',
  description: '今天日期与星期',
  run: ({ args }) => getRelativeDay(0, args.timezone as string | undefined),
});
