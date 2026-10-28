import { readPlanning, writePlanning } from '../typescript/planning';

test('planning fields round-trip while preserving assignment, deadline, tags and block ID', () => {
  const line = writePlanning('- [ ] Work #status/todo due 31-12 @assigned(Alex) ^work',
    { duration: '1.5', unit: 'd', urgent: true });
  expect(readPlanning(line)).toEqual({ duration: '1.5', unit: 'd', urgent: true });
  expect(line).toContain('due 31-12 @assigned(Alex)');
  expect(line).toMatch(/@estimate\(1.5d\) @urgent \^work$/);
});

test('clearing optional planning fields does not delete other metadata', () => {
  expect(writePlanning('- [ ] Work @estimate(2h) @urgent #client ^work',
    { duration: '', unit: 'h', urgent: false })).toBe('- [ ] Work #client ^work');
});

test.each(['0', '-2', 'NaN', 'Infinity', '2 hours'])('invalid duration %s is rejected', duration => {
  expect(() => writePlanning('- [ ] Work', { duration, unit: 'h', urgent: false })).toThrow();
});
