const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/tracker-efb-kartentisch-host.js','utf8');
const diagnostic=source.slice(source.indexOf('  function captureLayoutDiagnostic()'),source.indexOf('  function boot('));
function harness(){
 const entries=[],timers=new Map();let next=0;
 const node=(top,height)=>({tagName:'DIV',clientWidth:400,clientHeight:height,getBoundingClientRect:()=>({left:0,top,width:600,height:height*1.5}),style:{setProperty:()=>assert.fail('Diagnostics must not write styles')}});
 const nodes={mapArea:node(0,200),compassHdgReadout:node(290,15),mapProfileCanvas:{...node(330,100),tagName:'CANVAS',width:1200,height:300},mapProfileScroll:{...node(330,100),scrollLeft:20,scrollWidth:800,scrollHeight:100}};
 const window={innerWidth:600,innerHeight:700,devicePixelRatio:2,GAEfbUiScale:{state:()=>({user:1.5,effective:1.5,surface:'physical',vr:false})},getComputedStyle:()=>({width:'400px',height:'100px',transform:'none',position:'relative',top:'auto',bottom:'auto',display:'block'}),setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
 const context={window,document:{body:node(0,450)},byId:id=>nodes[id],report:(...entry)=>entries.push(entry),pollingClosed:false};
 vm.createContext(context);vm.runInContext(diagnostic,context);
 return {context,nodes,entries,timers};
}
test('read-only geometry distinguishes rendered rectangles, client sizes and backing pixels',()=>{
 const h=harness(),data=h.context.window.gaEfbLayoutDiagnostic();
 assert.deepEqual(Array.from(data.nodes.mapProfileCanvas.pixels),[1200,300]);
 assert.deepEqual(Array.from(data.nodes.mapProfileCanvas.rect),[0,330,600,150]);
 assert.equal(data.headingPastMap,12.5);
 assert.equal(h.entries.length,0,'Manual capture has no logging side effects');
});
test('optional Coherent SVG measurement failures are isolated',()=>{
 const h=harness();h.nodes.compassHdgReadout.getBBox=()=>{throw Error('not supported');};
 const data=h.context.window.gaEfbLayoutDiagnostic();
 assert.equal(data.nodes.compassHdgReadout.svgError,'not supported');
 assert.equal(data.headingPastMap,12.5,'Unsupported getBBox must not hide course position');
 assert.equal(data.nodes.mapProfileCanvas.pixels[0],1200);
});
test('settled logging coalesces repeated changes and respects closed lifecycle',()=>{
 const h=harness();h.context.scheduleLayoutDiagnostic();h.context.scheduleLayoutDiagnostic();
 assert.equal(h.timers.size,1);const flush=[...h.timers.values()][0];flush();
 assert.ok(h.entries.length>1);for(const entry of h.entries)assert.ok(entry[4].length<=800,'Existing transport bound');
 const count=h.entries.length;h.context.pollingClosed=true;h.context.scheduleLayoutDiagnostic();[...h.timers.values()].at(-1)();assert.equal(h.entries.length,count);
});
