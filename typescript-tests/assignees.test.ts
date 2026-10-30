import { assigneesFromLine, assignPeopleLine, assigneeFromLine, assignLine, defaultPersonColor, updatePeople } from '../typescript/assignees';

test('assignment is saved before the block ID and preserves tags and deadline', () => {
  const line = assignLine('- [ ] Work #status/todo due 31-12-26 ^work', 'Alex Smith');
  expect(line).toBe('- [ ] Work #status/todo due 31-12-26 @assigned(Alex Smith) ^work');
  expect(assigneeFromLine(line)).toBe('Alex Smith');
});

test('reassigning replaces all previous assignment markers', () => {
  const line = assignLine('- [ ] Work @assigned(Alex) @assigned(Sam)', 'Jo');
  expect(line.match(/@assigned\(/g)).toHaveLength(1);
  expect(assigneeFromLine(line)).toBe('Jo');
});

test('unassigning leaves the task, due date and block ID intact', () => {
  const line = assignLine('- [ ] Work @assigned(Alex Smith) due 31-12 ^work', '');
  expect(line).not.toContain('@assigned');
  expect(line).toContain('due 31-12 ^work');
});

test('a colour update affects the existing person, using a case-insensitive identity', () => {
  expect(updatePeople([{ name: 'Alex', color: '#aabbcc' }], ' alex ', '#112233'))
    .toEqual([{ name: 'alex', color: '#112233' }]);
});

test('invalid names and colours are rejected', () => {
  expect(() => assignLine('- [ ] Work', 'Alex)\n- [ ] Other')).toThrow();
  expect(() => updatePeople([], 'Alex', 'red; color:white')).toThrow();
});

test('new people receive different default colours and an existing colour is reused', () => {
  const people: { name: string; color: string }[] = [];
  for (const name of ['Alex', 'Sam', 'Jo', 'Riley', 'Dana']) {
    people.push({ name, color: defaultPersonColor(name, people) });
  }
  expect(new Set(people.map(person => person.color)).size).toBe(5);
  expect(defaultPersonColor('Alex', people)).toBe(people[0].color);
});

test('multiple assignments round trip in tag order with four distinct people', () => {
  const names = ['Alex', 'Sam', 'Jo', 'Riley'];
  expect(assigneesFromLine(assignPeopleLine('- [ ] Shared ^shared', names))).toEqual(names);
  expect(assigneesFromLine('- [ ] Shared @assigned(Alex) @assigned(alex) @assigned(Sam)')).toEqual(['Alex','Sam']);
  expect(() => assignPeopleLine('- [ ] Shared', [...names, 'Dana'])).toThrow('four');
  expect(() => assignPeopleLine('- [ ] Shared', ['Alex','alex'])).toThrow('once');
});
