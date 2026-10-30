import { completionDefaultHours, needsCompletionDuration, withCompletionDuration } from '../typescript/completionDuration';

const completed = { lineNumber: 2, originalLine: '- [ ] Work @assigned(Alex) ^work',
  newText: '- [x] Work @assigned(Alex) @completed(2026-10-30T12:00:00) ^work' };

test('only completing a previously unestimated task prompts', () => {
  expect(needsCompletionDuration(completed)).toBe(true);
  expect(needsCompletionDuration({ ...completed, originalLine: completed.originalLine + ' @estimate(2h)' })).toBe(false);
  expect(needsCompletionDuration({ ...completed, originalLine: completed.newText, newText: completed.originalLine })).toBe(false);
  expect(needsCompletionDuration({ ...completed, newText: completed.originalLine + ' #todo' })).toBe(false);
});

test.each([1, 0.5, 12])('completion records %s hours without losing completion metadata or block ID', hours => {
  const result = withCompletionDuration(completed, hours);
  expect(result.originalLine).toBe(completed.originalLine);
  expect(result.newText).toBe(completed.newText.replace(' ^work', ' @takes(' + hours + 'h) ^work'));
});

test.each([0, -1, NaN, Infinity])('rejects invalid completion duration %s', hours => {
  expect(() => withCompletionDuration(completed, hours)).toThrow();
});

const killian = (estimate = '@takes(4h)', name = 'Killian') => ({ ...completed,
  originalLine: '- [ ] Work @assigned(' + name + ') ' + estimate + ' ^work',
  newText: '- [x] Work @assigned(' + name + ') ' + estimate + ' @completed(2026-10-30T12:00:00) ^work' });

test('Killian always prompts, preserving his estimate and recording his own spent hours', () => {
  const task = killian('@takes(4h) @assigned(Sam)');
  expect(needsCompletionDuration(task)).toBe(true);
  expect(withCompletionDuration(task, 3).newText).toContain('@takes(4h) @assigned(Sam) @completed(2026-10-30T12:00:00) @spent(3h) ^work');
  expect(completionDefaultHours(task)).toBe(4);
});

test('Killian matching ignores case; cancellation uses the estimate in hours or one hour if absent', () => {
  expect(needsCompletionDuration(killian('@takes(1.5d)', 'kIlLiAn'))).toBe(true);
  expect(completionDefaultHours(killian('@takes(1.5d)'))).toBe(12);
  expect(completionDefaultHours(killian(''))).toBe(1);
  expect(completionDefaultHours(killian('@estimate(2h)'))).toBe(2);
  expect(withCompletionDuration(killian(''), 1).newText).not.toContain('@takes');
});

test('recompletion replaces spent metadata without accumulating duplicate actuals', () => {
  const result = withCompletionDuration(killian('@takes(4h) @spent(2h)'), 3);
  expect(result.newText.match(/@spent\(/g)).toHaveLength(1);
  expect(result.newText).toContain('@takes(4h)');
  expect(result.newText).toContain('@spent(3h)');
});
