import { getRelativeDay } from '../../core/date-util';
import { defineDateCommand } from './shared';

export default defineDateCommand({
  name: 'yesterday',
  description: '昨天日期与星期',
  run: ({ args }) => getRelativeDay(-1, args.timezone as string | undefined),
});
