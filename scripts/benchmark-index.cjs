const vm = require('vm');
const fs = require('fs');
const {performance} = require('perf_hooks');
const context = {console:{log(){},warn(){},error(){}},setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.env.BENCH_WORKER || 'elm-stuff/smoke-worker.js','utf8'),context);
(async()=>{
 for(const files of JSON.parse(process.env.BENCH_FILES || "[250,1000,2000]")) {
  const app=context.Elm.Worker.init({flags:{dataviewTaskCompletion:{taskCompletionTracking:false,taskCompletionUseEmojiShorthand:false,taskCompletionText:'completion'}}});
  let added=0;let loadedResolve;const loaded=new Promise(resolve=>loadedResolve=resolve);
  app.ports.interopFromElm.subscribe(message=>{if(message.tag==='tasksAdded')added++;if(message.tag==='allTasksLoaded')loadedResolve();});
  const content=Array.from({length:10},(_,i)=>'- [ ] Task '+i+' @takes(2h) @assigned(Killian) #status/todo').join('\n');
  const start=performance.now();
  for(let i=0;i<files;i++)app.ports.interopToElm.send({tag:'fileAdded',data:{filePath:'Note'+i+'.md',fileDate:null,currentYear:2026,fileContents:content}});
  app.ports.interopToElm.send({tag:'allMarkdownLoaded',data:{}});await loaded;
  console.log(JSON.stringify({files,tasks:files*10,milliseconds:Math.round(performance.now()-start),incrementalMessages:added}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
