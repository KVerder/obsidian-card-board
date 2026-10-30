const mockMessages: any[] = [];
const mockNotices: string[] = [];
let mockWorkerListener: (message: any) => void;
let mockTerminated = false;
jest.mock('obsidian', () => ({
  Plugin: class { app: any; async loadData() { return { version:'0.13.0',data:{globalSettings:{filters:[] as any[]},boardConfigs:[] as any[]} }; } registerView() {} registerEvent() {} addRibbonIcon() {} addCommand(command: any) { return command; } async saveData() {} },
  TFile: class { extension='md'; constructor(public path: string) {} },
  Notice: class { constructor(message: string) { mockNotices.push(message); } },
  addIcon() {}, normalizePath: (value: string) => value
}), {virtual:true});
jest.mock('../typescript/view',()=>({VIEW_TYPE_CARD_BOARD:'card-board-view',CardBoardView:class{}}));
jest.mock('../src/Worker.elm?worker-source',()=> 'compiled worker source',{virtual:true});
jest.mock('obsidian-daily-notes-interface',()=>({getDateFromFile:()=>null}));
jest.mock('../typescript/parserWorker',()=>({ParserWorker:class {
  ports = {interopFromElm:{subscribe:(listener:any)=>{mockWorkerListener=listener;}},interopToElm:{send:(message:any)=>{mockMessages.push(message);if(message.tag==='allMarkdownLoaded')mockWorkerListener({tag:'allTasksLoaded'});if(message.tag==='viewInitialized')mockWorkerListener({tag:'allTaskItems',data:[]});}}};
  async flush() {} terminate() {mockTerminated=true;}
}}));
import Plugin from '../typescript/main';
import {TFile} from 'obsidian';
function fixture() {
  const file=new (TFile as any)('Tasks.md');const plain=new (TFile as any)('Notes.md');
  const read=jest.fn(async(f:any):Promise<string>=>f===file?'- [ ] Work @takes(4h)':'No tasks here');
  const plugin:any=new Plugin({} as any,{} as any);
  plugin.app={plugins:{getPlugin:():undefined=>undefined},vault:{on:()=>({}),getMarkdownFiles:()=>[file,plain],getAbstractFileByPath:(path:string)=>path===file.path?file:path===plain.path?plain:null,cachedRead:read,read},workspace:{onLayoutReady:()=>{},getLeavesOfType:():any[]=>[],detachLeavesOfType:()=>{}},commands:{removeCommand:()=>{}}};
  return {plugin,file,read};
}
beforeEach(()=>{mockMessages.length=0;mockNotices.length=0;mockTerminated=false;});
test('startup registers controls but reads zero notes until a board requests data',async()=>{
  const {plugin,read}=fixture();await plugin.onload();await plugin.onLayoutReady();
  expect(read).not.toHaveBeenCalled();expect(mockMessages).toEqual([]);
  await plugin.viewInitialized();await plugin.indexPromise;
  expect(read).toHaveBeenCalledTimes(2);
  expect(mockMessages.filter(message=>message.tag==='fileAdded')).toHaveLength(1);
  expect(mockMessages.some(message=>message.tag==='allMarkdownLoaded')).toBe(true);
  expect(mockMessages.some(message=>message.tag==='viewInitialized')).toBe(true);
  expect(mockNotices).toEqual([]);
});
test('a restored view requesting data before layout readiness starts indexing after layout',async()=>{
  const {plugin,read}=fixture();await plugin.onload();await plugin.viewInitialized();expect(read).not.toHaveBeenCalled();
  await plugin.onLayoutReady();await plugin.indexPromise;expect(read).toHaveBeenCalledTimes(2);
  plugin.onunload();expect(mockTerminated).toBe(true);
});
test('changes during initial reads reconcile the latest text instead of indexing a stale snapshot',async()=>{
  const {plugin,file,read}=fixture();await plugin.onload();await plugin.onLayoutReady();
  read.mockImplementationOnce(async()=>{await plugin.handleFileModified(file);return '- [ ] Stale';});
  read.mockImplementation(async()=>'- [ ] Latest');
  await plugin.viewInitialized();await plugin.indexPromise;
  expect(mockMessages.some(message=>message.data?.fileContents==='- [ ] Stale')).toBe(false);
  expect(mockMessages.some(message=>message.tag==='fileModified'&&message.data.fileContents==='- [ ] Latest')).toBe(true);
});
