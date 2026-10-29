import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTypedName} from '../dist/quiz-answer.mjs';
const alex={name:'Alex Morgan Chen'}, sam={name:'Sam Green'};
test('full names ignore case, extra spaces, accents and punctuation',()=>{
 const person={name:'José Anne-Marie O’Neill'};
 assert.equal(checkTypedName('  JOSE Anne Marie ONeill  ',person,[person]),true);
 assert.equal(checkTypedName('Alex Morgan Chen',alex,[alex,sam]),true);
});
test('unique first and last names work without middle names',()=>{
 assert.equal(checkTypedName('alex chen',alex,[alex,sam]),true);
});
test('shared first and last names require a full name',()=>{
 const other={name:'Alex Jordan Chen'};
 assert.equal(checkTypedName('Alex Chen',alex,[alex,other]),false);
 assert.equal(checkTypedName('Alex Morgan Chen',alex,[alex,other]),true);
});
test('empty, first-only, wrong-person and misspelled answers are incorrect',()=>{
 for(const answer of ['', '   ', 'Alex', 'Sam Green', 'Alex Chenn'])assert.equal(checkTypedName(answer,alex,[alex,sam]),false);
});
test('single-token names can be answered in full',()=>{
 const person={name:'Sasha'};assert.equal(checkTypedName('sasha',person,[person]),true);
});
