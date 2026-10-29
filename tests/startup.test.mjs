import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Exercise the app's real startup with database callbacks deliberately held open.
const source=(await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../dist/app.mjs',import.meta.url).href));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot(saved){
 const renders=[],attributes={},openRequest={},readRequest={};
 const app={set innerHTML(html){renders.push(html)},setAttribute(key,value){attributes[key]=value}};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const elements={'#app':app,'#toast':toast,'#editor':{open:false},'#pdf-input':{},'#json-input':{}};
 let stored=JSON.stringify(saved);
 const database={transaction:()=>({objectStore:()=>({getAll:()=>readRequest})})};
 runInNewContext(source,{
  document:{querySelector:key=>elements[key]??null,querySelectorAll:()=>[],addEventListener(){}},
  indexedDB:{open:()=>openRequest},
  window:{scrollY:0,scrollTo(){},addEventListener(){}},
  sessionStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value}},
  setTimeout:()=>1,clearTimeout(){},
 });
 return {renders,attributes,toast,app,stored:()=>stored,async open(){openRequest.result=database;openRequest.onsuccess();await tick()},async load(decks){readRequest.result=decks;readRequest.onsuccess();await tick()},async fail(){openRequest.onerror();await tick()}};
}

test('slow database startup renders only the restored tab, never an interim import screen',async()=>{
 const saved={view:'quiz',activeId:'class',quizFormat:'choice'};
 const app=boot(saved);
 assert.equal(app.renders.length,0);
 await app.open();
 assert.equal(app.renders.length,0,'wait for roster data as well as database connection');
 assert.deepEqual(JSON.parse(app.stored()),saved,'loading must not overwrite saved navigation');
 await app.load([{id:'class',title:'Test class',created:1,cards:[{id:'one',name:'Alex'}]}]);
 assert.equal(app.renders.length,1);
 assert.match(app.renders[0],/Put a name to the face/);
 assert.match(app.renders[0],/Multiple choice<\/button>/);
 assert.doesNotMatch(app.renders[0],/Your roster, ready to review/);
 assert.equal(app.attributes['aria-busy'],'false');
});

test('first visit opens onboarding once loading completes',async()=>{
 const app=boot(null);
 await app.open();await app.load([]);
 assert.equal(app.renders.length,1);
 assert.match(app.renders[0],/Your roster, ready to review/);
 assert.equal(app.attributes['aria-busy'],'false');
});

test('unavailable database exits loading and leaves import and export usable',async()=>{
 const app=boot({view:'study',activeId:'class'});
 await app.fail();
 assert.equal(app.renders.length,1);
 assert.match(app.renders[0],/Your roster, ready to review/);
 assert.match(app.toast.textContent,/Browser storage is unavailable/);
 assert.equal(app.attributes['aria-busy'],'false');
 assert.equal(JSON.parse(app.stored()).activeId,'class');
});

const roster={id:'class',title:'Test class',created:1,cards:[{id:'one',name:'Alex'},{id:'two',name:'Jamie'},{id:'three',name:'Taylor'}]};
const round={mode:'study',ids:['three','one','two'],index:1,flipped:true,onlyLearning:true,correct:1,review:0,ratings:{three:true}};
test('refresh resumes shuffled card, flipped side, learning filter and ratings',async()=>{
 const app=boot({view:'study',activeId:'class',session:round});
 await app.open();await app.load([roster]);
 assert.match(app.renders[0],/Card 2 of 3/);
 assert.match(app.renders[0],/Show photo/);
 assert.match(app.renders[0],/<h2>Alex<\/h2>/);
 const resumed=JSON.parse(app.stored()).session;
 assert.deepEqual(resumed.ids,round.ids);
 assert.equal(resumed.onlyLearning,true);
 assert.deepEqual(resumed.ratings,{three:true});
});
test('cached card is read-only while loading and matching data unlocks it without repainting',async()=>{
 const app=boot({view:'study',activeId:'class',session:round,previewDecks:[roster]});
 assert.equal(app.renders.length,1);
 assert.match(app.renders[0],/Card 2 of 3/);
 assert.equal(app.app.inert,true);
 assert.equal(app.attributes['aria-busy'],'true');
 await app.open();await app.load([roster]);
 assert.equal(app.renders.length,1,'do not rebuild the portrait when the cached screen matches');
 assert.equal(app.app.inert,false);
 assert.equal(app.attributes['aria-busy'],'false');
});
test('a changed roster invalidates a stale round instead of displaying a missing card',async()=>{
 const app=boot({view:'study',activeId:'class',session:round});
 await app.open();await app.load([{...roster,cards:roster.cards.slice(1)}]);
 assert.match(app.renders[0],/Card 1 of 2/);
 assert.match(app.renders[0],/Reveal name and details/);
 assert.doesNotMatch(app.renders[0],/Show photo/);
});
test('completed rounds remain on results after refresh',async()=>{
 const app=boot({view:'study',activeId:'class',session:{...round,index:3,correct:2,review:1}});
 await app.open();await app.load([roster]);
 assert.match(app.renders[0],/Nice to meet them. Again./);
 assert.match(app.renders[0],/2 marked “know it”/);
});
test('quiz refresh retains the question, answer feedback, options and score',async()=>{
 const session={...round,mode:'quiz',options:['two','one','three'],answered:'one',typedAnswer:'Alex'};
 const app=boot({view:'quiz',activeId:'class',session});
 await app.open();await app.load([roster]);
 assert.match(app.renders[0],/Question 2 of 3/);
 assert.match(app.renders[0],/That’s right/);
 assert.match(app.renders[0],/value="Alex"/);
 assert.equal(JSON.parse(app.stored()).session.correct,1);
});
test('storage failure cannot turn a partial preview into an editable roster',async()=>{
 const app=boot({view:'study',activeId:'class',session:round,previewDecks:[roster]});
 await app.fail();
 assert.match(app.renders.at(-1),/Your roster, ready to review/);
 assert.doesNotMatch(app.renders.at(-1),/Current roster/);
 assert.equal(app.app.inert,false);
});

test('changed saved details replace the preview once the database is ready',async()=>{
 const app=boot({view:'study',activeId:'class',session:round,previewDecks:[roster]});
 await app.open();await app.load([{...roster,cards:roster.cards.map(c=>c.id==='one'?{...c,name:'Alex Updated'}:c)}]);
 assert.equal(app.renders.length,2);
 assert.match(app.renders.at(-1),/<h2>Alex Updated<\/h2>/);
 assert.equal(app.app.inert,false);
});
