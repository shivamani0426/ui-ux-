import test from 'node:test';
import assert from 'node:assert/strict';
import {STYLES,REFERENCES,recommend,exportPrompt} from '../design-engine.mjs';

test('all three directions are available for every valid brief',()=>{
  const output=recommend('Build a futuristic AI security analytics dashboard',{});
  assert.equal(output.designs.length,3);
  assert.deepEqual(new Set(output.designs.map(x=>x.id)),new Set(['minimal','glass','creative']));
  assert.equal(output.designs[0].id,'glass');
  assert.equal(output.designs[0].references.length,0,
    'Generic design advice must not silently include archived website suggestions');
});
test('explicit feedback influences future recommendations',()=>{
  const base=recommend('Build a general digital product for teams',{});
  const learned=recommend('Build a general digital product for teams',{styleWeights:{creative:5}});
  assert.ok(learned.designs.find(d=>d.id==='creative').match>base.designs.find(d=>d.id==='creative').match);
});
test('reference seed identifies only verified category rankings',()=>{
  assert.equal(REFERENCES.length,15);
  assert.equal(REFERENCES.filter(r=>r.rank).length,12);
  assert.deepEqual(REFERENCES.filter(r=>r.rank).map(r=>r.rank),Array.from({length:12},(_,i)=>i+1));
  assert.ok(REFERENCES.every(r=>r.site.startsWith('https://')));
});
test('build prompt respects all three selected directions',()=>{
  const p={brief:'Creative school dashboard',recommendations:recommend('Creative school dashboard')};
  const prompt=exportPrompt(p,STYLES.map(s=>s.id));
  for(const s of STYLES)assert.ok(prompt.includes(s.name));
  assert.ok(prompt.includes('without copying')||prompt.includes('rather than copying'));
});

test('Select prompt includes project requirements and does not treat fit as measured evidence',()=>{
  const brief='Create a student dashboard with assignments and a calendar. Must preserve existing backend.';
  const p={brief,recommendations:recommend(brief)};
  const prompt=exportPrompt(p,['minimal','glass']);
  assert.match(prompt,/Students \/ learners/);
  assert.match(prompt,/Assignments and tasks/);
  assert.match(prompt,/Calendar and schedule/);
  assert.match(prompt,/Preserve existing backend/);
  assert.match(prompt,/structural anchor/);
  assert.match(prompt,/not executable code/i);
});
