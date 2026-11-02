import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {editableFields,planRosterRollback} from '../dist/roster-update.mjs';

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
 const context=createContext({
  crypto:{randomUUID},editableFields,planRosterRollback,queueMicrotask,confirm:()=>true,
  FormData:class{constructor(form){return form.entries}},
  document:{querySelector:key=>elements[key]??null,querySelectorAll:()=>[],addEventListener(){}},
  indexedDB:{open:()=>openRequest},
  window:{scrollY:0,scrollTo(){},addEventListener(){}},
  sessionStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value}},
  setTimeout:()=>1,clearTimeout(){},
 });
 runInContext(source,context);
 return {run:code=>runInContext(code,context),context,elements,renders,attributes,toast,app,stored:()=>stored,async open(){openRequest.result=database;openRequest.onsuccess();await tick()},async load(decks){readRequest.result=decks;readRequest.onsuccess();await tick()},async fail(){openRequest.onerror();await tick()}};
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
 const app=boot({view:'study',activeId:'class',session:{...round,index:3,correct:2,review:1,ratings:{one:true,two:true,three:false}}});
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

function setupSave(app,fail=false){
 app.context.saveFails=fail;
 app.run(`db={transaction(){const tx={objectStore:()=>({put(){queueMicrotask(()=>saveFails?tx.onerror():tx.oncomplete())}})};return tx}}`);
}
async function loadedApp(){const app=boot(null);await app.open();await app.load([JSON.parse(JSON.stringify(roster))]);return app}
test('switching tabs preserves independent study and quiz rounds, even through roster refresh',async()=>{
 const app=await loadedApp();
 app.run(`navigate('study');action('skip');action('flip');navigate('quiz');session.typedAnswer='draft';navigate('roster');navigate('study')`);
 assert.match(app.renders.at(-1),/Card 2 of 3/);
 assert.match(app.renders.at(-1),/Show photo/);
 app.run(`navigate('roster')`);
 const reopened=boot(JSON.parse(app.stored()));await reopened.open();await reopened.load([roster]);
 reopened.run(`navigate('quiz')`);assert.match(reopened.renders.at(-1),/value="draft"/);
 reopened.run(`navigate('study')`);assert.match(reopened.renders.at(-1),/Card 2 of 3/);
});
test('skipped cards are not counted as reviewed and can be retried separately',async()=>{
 const app=await loadedApp();
 app.run(`navigate('study');action('skip');action('skip');action('skip')`);
 assert.match(app.renders.at(-1),/big-stat">0</);
 assert.match(app.renders.at(-1),/3 skipped/);
 assert.match(app.renders.at(-1),/Review skipped cards/);
 app.run(`action('retry-skipped');action('flip');action('skip');action('skip');action('skip')`);
 assert.match(app.renders.at(-1),/big-stat">1</);
 assert.match(app.renders.at(-1),/2 skipped/);
 app.run(`action('retry-skipped')`);assert.match(app.renders.at(-1),/Card 1 of 2/);
});
test('practice scope exposes the actual selected state',async()=>{
 const app=await loadedApp();app.run(`navigate('study')`);
 assert.match(app.renders.at(-1),/aria-pressed="true" class="selected" data-action="practice-all"/);
 app.run(`action('practice-learning')`);
 assert.match(app.renders.at(-1),/aria-pressed="true" class="selected" data-action="practice-learning"/);
});
test('restore resets unrelated search and filter; failed save stays visible until retry succeeds',async()=>{
 const app=await loadedApp();setupSave(app,true);
 app.elements['#save-status']={hidden:true};
 app.context.backup={size:1,text:async()=>JSON.stringify({format:'facefolio',version:1,deck:{title:'Restored',cards:[{name:'Jamie Rivera'}]}})};
 app.run(`search='Alex';filter='known'`);
 await app.run('restore(backup)');
 assert.match(app.renders.at(-1),/<h3>Jamie Rivera/);
 assert.doesNotMatch(app.renders.at(-1),/No people match|value="Alex"/);
 assert.match(app.toast.textContent,/Not saved/);
 assert.equal(app.elements['#save-status'].hidden,false);
 app.context.saveFails=false;await app.run(`action('retry-save')`);
 assert.equal(app.elements['#save-status'].hidden,true);
 assert.match(app.toast.textContent,/Roster saved/);
});
test('failed card edits remain available to retry without a false saved message',async()=>{
 const app=await loadedApp();setupSave(app,true);
 app.elements['#save-status']={hidden:true};
 app.elements['#editor'].querySelector=()=>({});app.elements['#editor'].showModal=()=>{};app.elements['#editor'].close=()=>{};
 app.elements['#photo-file']={};app.elements['#edit-form']={};app.elements['#delete-card']={};
 app.run(`editCard('one')`);
 await app.elements['#edit-form'].onsubmit({preventDefault(){},target:{entries:[['name','Alex Edited'],['notes','Do not lose this note']]}});
 assert.match(app.toast.textContent,/Not saved/);
 assert.equal(app.run(`deck().cards[0].notes`),'Do not lose this note');
 assert.equal(app.elements['#save-status'].hidden,false);
});
test('undo and redo require confirmation and retain edits and progress made after update',async()=>{
 const app=await loadedApp();setupSave(app);
 app.run(`decks[0].previousVersion=JSON.parse(JSON.stringify(decks[0]));decks[0].cards[0].notes='New note';decks[0].cards[0].known=true`);
 app.context.confirm=()=>false;await app.run('undoUpdate()');
 assert.equal(app.run(`deck().cards[0].notes`),'New note');
 app.context.confirm=()=>true;await app.run('undoUpdate()');
 assert.equal(app.run(`deck().cards[0].notes`),undefined);
 assert.equal(app.run(`deck().redoVersion.cards[0].notes`),'New note');
 assert.match(app.renders.at(-1),/Redo roster update/);
 await app.run('undoUpdate(true)');
 assert.equal(app.run(`deck().cards[0].notes`),'New note');
 assert.equal(app.run(`deck().cards[0].known`),true);
 assert.equal(app.run(`deck().previousVersion.redoVersion`),undefined);
});
test('failed undo leaves current roster and its history unchanged',async()=>{
 const app=await loadedApp();setupSave(app,true);
 app.run(`decks[0].previousVersion=JSON.parse(JSON.stringify(decks[0]));decks[0].cards[0].notes='Retain me'`);
 await app.run('undoUpdate()');
 assert.equal(app.run(`deck().cards[0].notes`),'Retain me');
 assert.equal(app.run(`Boolean(deck().previousVersion)`),true);
 assert.equal(app.run(`unsavedDecks.size`),0);
 assert.match(app.toast.textContent,/current roster is unchanged/);
});
