import { expect, test } from 'claude-code/testing'
import { clockSetting, dateFormat, stamp } from '../hooks/tree'

const afternoon = new Date(2026, 10, 4, 15, 40).getTime()
const morning = new Date(2026, 10, 4, 0, 5).getTime()

test('the date column keeps year-month-day on a 24h clock by default', () => {
  expect(stamp(afternoon)).toBe('2026-11-04 15:40')
  expect(stamp(0)).toBe('')
})

test('day-month and month-day leave out the year', () => {
  expect(stamp(afternoon, 'day-month')).toBe('04-11 15:40')
  expect(stamp(afternoon, 'month-day')).toBe('11-04 15:40')
})

test('the 12h clock writes AM and PM, padded so the column lines up', () => {
  expect(stamp(afternoon, 'day-month', '12h')).toBe('04-11  3:40 PM')
  expect(stamp(morning, 'year-month-day', '12h')).toBe('2026-11-04 12:05 AM')
})

test('unknown setting values fall back to the defaults', () => {
  expect(dateFormat('dd-mm')).toBe('year-month-day')
  expect(dateFormat(undefined)).toBe('year-month-day')
  expect(dateFormat('day-month')).toBe('day-month')
  expect(clockSetting('am/pm')).toBe('24h')
  expect(clockSetting('12h')).toBe('12h')
})
