import { getNow } from '../../core/date-util';
import { defineDateCommand } from './shared';

export default defineDateCommand({
  name: 'now',
  description: '当前日期时间（含星期）',
  run: ({ args }) => getNow(args.timezone as string | undefined),
});
