import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  dateDiff,
  DateInputError,
  getDateInfo,
  getNow,
  getRange,
  getRelativeDay,
  parseYmd,
} from './date-util';

describe('date-util', () => {
  it('parses valid YYYY-MM-DD', () => {
    assert.deepEqual(parseYmd('2026-07-02'), { year: 2026, month: 7, day: 2 });
  });

  it('rejects invalid calendar date', () => {
    assert.throws(() => parseYmd('2026-02-30'), DateInputError);
    assert.throws(() => parseYmd('2026/07/02'), DateInputError);
  });

  it('returns weekday for a known date in Asia/Shanghai', () => {
    const info = getDateInfo('2026-07-02', 'Asia/Shanghai');
    assert.equal(info.date, '2026-07-02');
    assert.equal(info.weekday, '星期四');
    assert.equal(info.weekdayNum, 4);
    assert.equal(info.timezone, 'Asia/Shanghai');
  });

  it('adds and subtracts calendar days', () => {
    const next = addDays('2026-07-02', 1, 'Asia/Shanghai');
    assert.equal(next.date, '2026-07-03');
    assert.equal(next.weekday, '星期五');

    const prev = addDays('2026-07-02', -1, 'Asia/Shanghai');
    assert.equal(prev.date, '2026-07-01');
    assert.equal(prev.weekday, '星期三');
  });

  it('computes date diff in days', () => {
    assert.deepEqual(dateDiff('2026-07-01', '2026-07-02'), {
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      days: 1,
    });
    assert.deepEqual(dateDiff('2026-07-02', '2026-07-02').days, 0);
  });

  it('builds today range with half-open interval', () => {
    const range = getRange('today', 'Asia/Shanghai');
    assert.equal(range.range, 'today');
    assert.match(range.from, /^\d{4}-\d{2}-\d{2} 00:00:00$/);
    assert.match(range.to, /^\d{4}-\d{2}-\d{2} 00:00:00$/);
    assert.ok(range.from < range.to);
  });

  it('builds yesterday range ending at today midnight', () => {
    const today = getRelativeDay(0, 'Asia/Shanghai');
    const yesterday = getRelativeDay(-1, 'Asia/Shanghai');
    const range = getRange('yesterday', 'Asia/Shanghai');
    assert.equal(range.from, `${yesterday.date} 00:00:00`);
    assert.equal(range.to, `${today.date} 00:00:00`);
  });

  it('builds this-week from Monday', () => {
    const range = getRange('this-week', 'Asia/Shanghai');
    const monday = getDateInfo(range.from.slice(0, 10), 'Asia/Shanghai');
    assert.equal(monday.weekdayNum, 1);
  });

  it('getNow returns datetime and weekday', () => {
    const now = getNow('Asia/Shanghai');
    assert.match(now.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(now.datetime ?? '', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.ok(now.weekdayNum >= 1 && now.weekdayNum <= 7);
    assert.ok(now.weekday.startsWith('星期'));
  });
});
