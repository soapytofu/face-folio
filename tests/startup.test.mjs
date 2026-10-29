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
  sessionStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value}},
  setTimeout:()=>1,clearTimeout(){},
 });
 return {renders,attributes,toast,stored:()=>stored,async open(){openRequest.result=database;openRequest.onsuccess();await tick()},async load(decks){readRequest.result=decks;readRequest.onsuccess();await tick()},async fail(){openRequest.onerror();await tick()}};
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
