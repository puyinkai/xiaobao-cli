/**
 * Local date/time helpers for `xiaobao-cli date *` (no network).
 *
 * Default timezone: Asia/Shanghai (or TZ env). Weekday numbering: 1=Monday … 7=Sunday.
 */

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAY_SHORT_TO_NUM: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const WEEKDAY_ZH: Record<number, string> = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六',
  7: '星期日',
};

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'last-7-days'
  | 'today-so-far';

export type DateInfo = {
  date: string;
  datetime?: string;
  timezone: string;
  weekday: string;
  weekdayNum: number;
};

export type DateRange = {
  range: DatePreset;
  timezone: string;
  from: string;
  to: string;
  date: string;
  weekday: string;
  weekdayNum: number;
};

export class DateInputError extends Error {
  readonly code = 'INVALID_DATE';

  readonly hint = '日期须为 YYYY-MM-DD；days 须为非负整数';

  constructor(message: string) {
    super(message);
    this.name = 'DateInputError';
  }
}

type Ymd = { year: number; month: number; day: number };

type ZonedParts = Ymd & {
  hour: number;
  minute: number;
  second: number;
  weekdayShort: string;
};

export function resolveTimezone(input?: string): string {
  const tz = (input ?? process.env.TZ ?? DEFAULT_TIMEZONE).trim();
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    throw new DateInputError(`无效时区: ${tz}`);
  }
}

export function parseYmd(date: string): Ymd {
  const m = DATE_RE.exec(date.trim());
  if (!m) {
    throw new DateInputError(`无效日期: ${date}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new DateInputError(`无效日期: ${date}`);
  }
  return { year, month, day };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(ymd: Ymd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

function formatDateTime(parts: ZonedParts): string {
  return `${formatYmd(parts)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(instant);

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const hourRaw = Number(pick('hour'));
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour,
    minute: Number(pick('minute')),
    second: Number(pick('second')),
    weekdayShort: pick('weekday'),
  };
}

function weekdayNumFromShort(short: string): number {
  const num = WEEKDAY_SHORT_TO_NUM[short];
  if (!num) {
    throw new DateInputError(`无法解析星期: ${short}`);
  }
  return num;
}

function weekdayZh(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'long' }).format(instant);
}

function zonedInstant(ymd: Ymd, hms: string, timeZone: string): Date {
  const [hh, mm, ss] = hms.split(':').map(Number);
  const utcGuess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, hh, mm, ss);
  const offset = getTimezoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offset);
}

function getTimezoneOffsetMs(timeZone: string, date: Date): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function addCalendarDays(ymd: Ymd, offset: number): Ymd {
  const dt = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + offset));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function buildDateInfo(parts: ZonedParts, timeZone: string, instant: Date): DateInfo {
  const weekdayNum = weekdayNumFromShort(parts.weekdayShort);
  return {
    date: formatYmd(parts),
    datetime: formatDateTime(parts),
    timezone: timeZone,
    weekday: weekdayZh(instant, timeZone),
    weekdayNum,
  };
}

export function getNow(timeZoneInput?: string): DateInfo {
  const timeZone = resolveTimezone(timeZoneInput);
  const instant = new Date();
  const parts = getZonedParts(instant, timeZone);
  return buildDateInfo(parts, timeZone, instant);
}

export function getDateInfo(date: string, timeZoneInput?: string): DateInfo {
  const timeZone = resolveTimezone(timeZoneInput);
  const ymd = parseYmd(date);
  const instant = zonedInstant(ymd, '00:00:00', timeZone);
  const parts = getZonedParts(instant, timeZone);
  return {
    date: formatYmd(parts),
    timezone: timeZone,
    weekday: weekdayZh(instant, timeZone),
    weekdayNum: weekdayNumFromShort(parts.weekdayShort),
  };
}

export function getRelativeDay(offsetDays: number, timeZoneInput?: string): DateInfo {
  const timeZone = resolveTimezone(timeZoneInput);
  const nowParts = getZonedParts(new Date(), timeZone);
  const target = addCalendarDays(nowParts, offsetDays);
  return getDateInfo(formatYmd(target), timeZone);
}

export function addDays(date: string, offset: number, timeZoneInput?: string): DateInfo {
  const timeZone = resolveTimezone(timeZoneInput);
  const ymd = parseYmd(date);
  const target = addCalendarDays(ymd, offset);
  return getDateInfo(formatYmd(target), timeZone);
}

export function dateDiff(startDate: string, endDate: string): { days: number; startDate: string; endDate: string } {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  return {
    startDate: formatYmd(start),
    endDate: formatYmd(end),
    days: Math.round((endMs - startMs) / 86_400_000),
  };
}

function startOfWeekMonday(ymd: Ymd, timeZone: string): Ymd {
  const instant = zonedInstant(ymd, '12:00:00', timeZone);
  const weekday = weekdayNumFromShort(getZonedParts(instant, timeZone).weekdayShort);
  return addCalendarDays(ymd, -(weekday - 1));
}

function startOfMonth(ymd: Ymd): Ymd {
  return { year: ymd.year, month: ymd.month, day: 1 };
}

function nextMonthStart(ymd: Ymd): Ymd {
  if (ymd.month === 12) {
    return { year: ymd.year + 1, month: 1, day: 1 };
  }
  return { year: ymd.year, month: ymd.month + 1, day: 1 };
}

export function getRange(preset: DatePreset, timeZoneInput?: string): DateRange {
  const timeZone = resolveTimezone(timeZoneInput);
  const todayParts = getZonedParts(new Date(), timeZone);
  const today = formatYmd(todayParts);
  const tomorrow = formatYmd(addCalendarDays(todayParts, 1));
  const yesterday = formatYmd(addCalendarDays(todayParts, -1));

  let from: string;
  let to: string;

  switch (preset) {
    case 'today':
      from = `${today} 00:00:00`;
      to = `${tomorrow} 00:00:00`;
      break;
    case 'yesterday':
      from = `${yesterday} 00:00:00`;
      to = `${today} 00:00:00`;
      break;
    case 'today-so-far':
      from = `${today} 00:00:00`;
      to = formatDateTime(todayParts);
      break;
    case 'this-week': {
      const monday = formatYmd(startOfWeekMonday(todayParts, timeZone));
      const nextMonday = formatYmd(addCalendarDays(parseYmd(monday), 7));
      from = `${monday} 00:00:00`;
      to = `${nextMonday} 00:00:00`;
      break;
    }
    case 'this-month': {
      const monthStart = formatYmd(startOfMonth(todayParts));
      const nextMonth = formatYmd(nextMonthStart(todayParts));
      from = `${monthStart} 00:00:00`;
      to = `${nextMonth} 00:00:00`;
      break;
    }
    case 'last-7-days': {
      const start = formatYmd(addCalendarDays(todayParts, -6));
      from = `${start} 00:00:00`;
      to = `${tomorrow} 00:00:00`;
      break;
    }
    default:
      throw new DateInputError(`未知 preset: ${preset}`);
  }

  const anchor = getDateInfo(today, timeZone);
  return {
    range: preset,
    timezone: timeZone,
    from,
    to,
    date: anchor.date,
    weekday: anchor.weekday,
    weekdayNum: anchor.weekdayNum,
  };
}

export function weekdayLabel(num: number): string {
  return WEEKDAY_ZH[num] ?? String(num);
}
