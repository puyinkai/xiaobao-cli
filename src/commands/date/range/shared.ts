import type { DatePreset } from '../../../core/date-util';
import { getRange } from '../../../core/date-util';
import { defineDateCommand } from '../shared';

export function defineRangePresetCommand(preset: DatePreset, description: string) {
  return defineDateCommand({
    name: preset,
    description,
    run: ({ args }) => getRange(preset, args.timezone as string | undefined),
  });
}
