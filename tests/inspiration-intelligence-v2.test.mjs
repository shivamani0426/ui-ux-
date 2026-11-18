import test from 'node:test';
import assert from 'node:assert/strict';
import {inspirationBriefSignals,rankInspirations,makeSelectionPrompt} from '../inspiration-engine.mjs';

const refs=[
  {id:'student',name:'Student study hub',site:'https://example.org/learning',
    category:'Education',styles:['minimal'],tags:['education','dashboard','study'],score:1},
  {id:'store',name:'Shopping store',site:'https://example.org/commerce',
    category:'Commerce',styles:['creative'],tags:['commerce','checkout','shopping'],score:10},
  {id:'editorial',name:'Creative magazine',site:'https://example.org/mag',
    category:'Editorial',styles:['creative'],tags:['portfolio','editorial'],score:8}
];
test('08A: explicit exclusions are never rewarded as positive metadata matches',()=>{
  const signals=inspirationBriefSignals('Create a student dashboard without checkout.');
  assert.equal(signals.requested.has('commerce'),false);
  assert.equal(signals.excluded.has('commerce'),true);
  const scores=rankInspirations('Create a student study dashboard without checkout.',refs);
  assert.equal(scores[0].id,'student');
  const store=scores.find(x=>x.id==='store');
  assert.ok(store.evidence.excludedPenalty>0);
  assert.match(store.reasons.join(' '),/excluded feature/i);
});
test('08A: user taste helps weak ties but never defeats strong explicit brief',()=>{
  const r=rankInspirations('College student study dashboard',refs,{
    styleWeights:{creative:5},favoriteTags:['commerce','shopping','portfolio','editorial']});
  assert.equal(r[0].id,'student');
  assert.ok(r.every(x=>x.evidence.personal<=10));
  assert.ok(r.every(x=>x.evidence.direct<=80));
});
test('08B: invalid sources, unsafe URLs and duplicate IDs are excluded',()=>{
  const bad=[
    ...refs,
    {...refs[0],site:'https://duplicate.example'},
    {id:'file',site:'file:///etc/passwd'},
    {id:'evil',site:'javascript:alert(1)'},
    {id:'off',site:'https://example.org/off',active:false}
  ];
  const r=rankInspirations('student',bad);
  assert.equal(r.length,refs.length);
  assert.equal(r.find(x=>x.id==='student').site,'https://example.org/learning');
  assert.ok(r.every(x=>x.provenance.includes('not a live website scan')));
});
test('08B: deterministic ranking does not invent screenshots or measured quality',()=>{
  const a=rankInspirations('Creative editorial portfolio',refs);
  const b=rankInspirations('Creative editorial portfolio',refs);
  assert.deepEqual(a,b);
  assert.equal(a[0].id,'editorial');
  assert.ok(a.every(x=>!Object.hasOwn(x,'imageUrl')));
  assert.ok(a.every(x=>typeof x.evidence.direct==='number'));
});
test('08C: negative preferences do not create false confidence',()=>{
  const r=rankInspirations('An original design',refs,{
    styleWeights:{creative:-999},favoriteTags:[]});
  assert.ok(r.every(x=>x.matchScore===0));
  assert.ok(r.every(x=>x.matchLabel==='Explore alternative'));
});

test('08D: selected inspirations honor latest approved refinement and exclude forbidden modules',()=>{
  const project={
    brief:'Create a student study dashboard with attendance and calendar, without checkout.',
    recommendations:{refinement:'Prioritize mobile accessibility and do not add messaging.'}
  };
  const prompt=makeSelectionPrompt(project,refs.slice(0,1));
  assert.match(prompt,/LATEST APPROVED REFINEMENT/);
  assert.match(prompt,/Prioritize mobile accessibility/);
  assert.match(prompt,/EXPLICITLY OUT OF SCOPE/);
  assert.match(prompt,/checkout/i);
  assert.match(prompt,/messaging/i);
  assert.match(prompt,/Do not copy layouts/);
});
