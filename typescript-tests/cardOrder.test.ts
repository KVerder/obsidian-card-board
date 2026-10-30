import { renameOrderPaths, reorderKeys, withBlockId, orderKey, prepareOrder } from '../typescript/cardOrder';
import { TaskItem } from '../typescript/types';
const task = (lineNumber: number, originalLine: string): TaskItem => ({ fields: { filePath: 'Tasks.md', lineNumber, originalLine, originalBlock: originalLine }, subFields: [] } as TaskItem);

test('moves cards upward, downward, to empty columns, and to the end', () => {
  expect(reorderKeys(['a','b','c'], 'c', 'a')).toEqual(['c','a','b']);
  expect(reorderKeys(['a','b','c'], 'a', 'c')).toEqual(['b','a','c']);
  expect(reorderKeys(['a','b','c'], 'a', null)).toEqual(['b','c','a']);
  expect(reorderKeys([], 'a', null)).toEqual(['a']);
  expect(() => reorderKeys(['a'], 'b', 'missing')).toThrow();
});
test('anchors preserve existing block IDs and survive shifted line numbers', () => {
  expect(withBlockId('- [ ] Work ^existing', () => 'new')).toBe('- [ ] Work ^existing');
  expect(orderKey(task(1, '- [ ] Work ^existing'))).toBe(orderKey(task(25, '- [x] Work @takes(4h) ^existing')));
});
test('ordering anchors every destination card and keeps the requested sequence', () => {
  const a = task(1, '- [ ] A'); const b = task(2, '- [ ] B'); const c = task(3, '- [ ] C');
  let id = 0;
  const result = prepareOrder([a,b], c, a, () => String(++id));
  expect(result.order).toEqual(['Tasks.md#^cb-3','Tasks.md#^cb-1','Tasks.md#^cb-2']);
  expect(result.replacements).toHaveLength(3);
});

test('ordered identities follow note and folder renames without matching similar path prefixes', () => {
  const orders=[{ board:'Team', column:'Todo', tasks:['Work/A.md#^a','Work/B.md#^b','Workshop/C.md#^c'] }];
  expect(renameOrderPaths(orders,'Work','Archive')[0].tasks).toEqual(['Archive/A.md#^a','Archive/B.md#^b','Workshop/C.md#^c']);
  expect(renameOrderPaths(orders,'Work/A.md','Work/Renamed.md')[0].tasks).toEqual(['Work/Renamed.md#^a','Work/B.md#^b','Workshop/C.md#^c']);
});
