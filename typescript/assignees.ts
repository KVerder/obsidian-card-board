import { insertBeforeBlockId } from './cardEditing';

export type Person = { name: string; color: string };
const assignment = /(^|[ \t])@assigned\([^()\r\n]*\)/g;

export function assigneeFromLine(line: string): string {
  return assigneesFromLine(line)[0] || '';
}

export function assigneesFromLine(line: string): string[] {
  const names = Array.from(line.matchAll(/(?:^|[ \t])@assigned\(([^()\r\n]+)\)/g), match => match[1].trim());
  return names.filter((name, index) => name && names.findIndex(other => other.toLowerCase() === name.toLowerCase()) === index).slice(0, 4);
}

export function assignPeopleLine(line: string, names: string[]): string {
  names = names.map(name => name.trim()).filter(Boolean);
  if (names.length > 4) throw new Error('Assign at most four people.');
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Choose each person only once.');
  names.forEach(name => validatePerson(name, '#000000'));
  const clean = line.replace(assignment, '$1').trimEnd();
  return names.length ? insertBeforeBlockId(clean, names.map(name => '@assigned(' + name + ')').join(' ')) : clean;
}

export function validatePerson(name: string, color: string): void {
  if (name.length > 80 || /[()#\r\n]/.test(name)) throw new Error('Use a name of at most 80 characters without parentheses, hashtags or line breaks.');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose a valid person colour.');
}

export function assignLine(line: string, name: string): string {
  return assignPeopleLine(line, [name]);
}

export function updatePeople(people: Person[], name: string, color: string): Person[] {
  name = name.trim();
  validatePerson(name, color);
  if (!name) return people;
  return [...people.filter(person => person.name.trim().toLowerCase() !== name.toLowerCase()), { name, color }];
}

export function defaultPersonColor(name: string, people: Person[]): string {
  const existing = people.find(person => person.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) return existing.color;
  // Allocate unused pastel colours so newly added people have different defaults.
  const used = new Set(people.map(person => person.color.toLowerCase()));
  for (let index = 0; index < 360; index++) {
    const hue = ((people.length + index) * 137.508) % 360;
    const channel = (n: number) => {
      const k = (n + hue / 30) % 12;
      const value = 0.84 - 0.65 * Math.min(0.84, 0.16) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * value).toString(16).padStart(2, '0');
    };
    const color = '#' + channel(0) + channel(8) + channel(4);
    if (!used.has(color)) return color;
  }
  return '#d4e5f5';
}
