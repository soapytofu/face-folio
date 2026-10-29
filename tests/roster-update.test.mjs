import test from 'node:test';
import assert from 'node:assert/strict';
import {importedCard, planRosterUpdate} from '../dist/roster-update.mjs';
const card=(id,name,rest={})=>importedCard({id,name,major:'',program:'College / BA',year:'Junior',pronouns:'',notes:'',photo:'old-photo',known:false,...rest});
const deck=cards=>({id:'deck',title:'My class',created:1,fileName:'original.pdf',cards});
test('reordered PDF refreshes source details and preserves identity, edits and progress',()=>{
 const old=deck([card('a','Alex Chen'),card('b','Sam Green')]);
 old.cards[0].known=true;old.cards[0].notes='Met at orientation';old.cards[0].major='Biology';old.cards[0].name='Alex C.';
 const result=planRosterUpdate(old,[card('x','Sam Green',{year:'Senior',photo:'new-photo'}),card('y','  Alex   Chen  ',{year:'Senior'})],'updated.pdf',{},2);
 assert.deepEqual(result.next.cards.map(c=>c.id),['b','a']);
 assert.equal(result.next.cards[0].year,'Senior');assert.equal(result.next.cards[0].photo,'new-photo');
 assert.equal(result.next.cards[1].name,'Alex C.');assert.equal(result.next.cards[1].known,true);
 assert.equal(result.next.cards[1].notes,'Met at orientation');assert.equal(result.next.cards[1].major,'Biology');
 assert.equal(result.next.id,old.id);assert.equal(result.next.title,old.title);assert.deepEqual(result.next.previousVersion,old);
 assert.equal(old.cards[0].year,'Junior');
});
test('added and removed people are previewed; new people start unlearned',()=>{
 const old=deck([card('a','Alex Chen'),card('b','Sam Green')]);
 const r=planRosterUpdate(old,[card('x','Alex Chen'),card('y','New Student')],'new.pdf',{});
 assert.deepEqual(r.summary.added,['New Student']);assert.deepEqual(r.summary.removed,['Sam Green']);
 assert.equal(r.next.cards[1].known,false);assert.equal(r.next.previousVersion.cards.length,2);
});
test('duplicate names never receive another person’s notes or progress',()=>{
 const old=deck([card('a','Sam Green',{notes:'Personal note',known:true}),card('b','Sam Green')]);
 const r=planRosterUpdate(old,[card('x','Sam Green')],'new.pdf',{});
 assert.equal(r.next.cards[0].id,'x');assert.equal(r.next.cards[0].notes,'');assert.equal(r.next.cards[0].known,false);
 assert.deepEqual(r.summary.ambiguous,['Sam Green']);assert.equal(r.summary.removed.length,2);
 const dup=planRosterUpdate(deck([card('a','Alex')]),[card('x','Alex'),card('y','Alex')],'new.pdf',{});
 assert.equal(dup.summary.retained.length,0);assert.deepEqual(dup.summary.ambiguous,['Alex']);
});
test('a second update still matches original names and keeps only one undo snapshot',()=>{
 const old=deck([card('a','Alex Chen')]);old.cards[0].name='Alex C.';
 const first=planRosterUpdate(old,[card('b','Alex Chen')],'one.pdf',{}).next;
 const second=planRosterUpdate(first,[card('c','Alex Chen')],'two.pdf',{}).next;
 assert.equal(second.cards[0].id,'a');assert.equal(second.cards[0].name,'Alex C.');
 assert.equal(second.previousVersion.fileName,'one.pdf');assert.equal(second.previousVersion.previousVersion,undefined);
});
test('explicitly cleared edits stay empty and changed source names are not guessed',()=>{
 const old=deck([card('a','Alex Chen',{pronouns:'they/them'})]);old.cards[0].pronouns='';
 const matched=planRosterUpdate(old,[card('b','Alex Chen',{pronouns:'they/them'})],'new.pdf',{}).next;
 assert.equal(matched.cards[0].pronouns,'');
 const changed=planRosterUpdate(old,[card('c','Alex Chang')],'new.pdf',{});
 assert.equal(changed.summary.retained.length,0);assert.equal(changed.summary.removed.length,1);
});
