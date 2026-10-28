import { insertBeforeBlockId } from './cardEditing';

export type Planning = { duration: string; unit: 'h' | 'd'; urgent: boolean };

export function readPlanning(line: string): Planning {
  const match = /(?:^|[ \t])@estimate\((\d+(?:\.\d+)?)([hd])\)(?=$|[ \t])/.exec(line);
  return { duration: match?.[1] || '', unit: match?.[2] === 'd' ? 'd' : 'h',
    urgent: /(?:^|[ \t])@urgent(?=$|[ \t])/.test(line) };
}

export function writePlanning(line: string, planning: Planning): string {
  const input = planning.duration.trim();
  if (input && (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input) || !Number.isFinite(Number(input)) || Number(input) <= 0)) {
    throw new Error('Enter a positive duration in hours or working days, or leave it blank.');
  }
  let clean = line.replace(/[ \t]+@estimate\([^()\r\n]*\)(?=$|[ \t])/g, '')
    .replace(/[ \t]+@urgent(?=$|[ \t])/g, '').trimEnd();
  if (input) clean = insertBeforeBlockId(clean, '@estimate(' + Number(input) + planning.unit + ')');
  if (planning.urgent) clean = insertBeforeBlockId(clean, '@urgent');
  return clean;
}
