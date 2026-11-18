import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLearningEngine,LEARNING_CASES} from '../learning-evaluation.mjs';
import {analyzeProject,compareDirections} from '../project-intelligence.mjs';
import {STYLES} from '../design-engine.mjs';
import {normalizeProfile,learnFeedbackTransition,latestFeedbackChoices,
  visitorCohortBand,preferenceHints} from '../learning-engine.mjs';

test('Synthetic learning benchmark remains deterministic and all brief-first rankings pass',()=>{
  const first=evaluateLearningEngine(),second=evaluateLearningEngine();
  assert.deepEqual(second,first,'Reproducible reports cannot depend on random values or live APIs');
  assert.equal(first.fixtureCount,LEARNING_CASES.length);
  assert.ok(first.checkCount>=50);
  assert.equal(first.failed,0,JSON.stringify(first.failures));
  assert.equal(first.passed,first.checkCount);
  assert.match(first.evaluation,/NOT real-world usability/);
});
test('Feedback is an explainable bounded adjustment, never an empirical quality claim',()=>{
  const analysis=analyzeProject('Create an accessible student assignment dashboard for low-power devices');
  const preferences={styleWeights:{minimal:5,glass:-5,creative:2}};
  const scored=compareDirections(analysis,STYLES,preferences);
  const baseline=compareDirections(analysis,STYLES,{});
  for(const direction of scored){
    const previous=baseline.find(x=>x.id===direction.id);
    assert.equal(direction.personalization.appliedPointAdjustment,direction.match-previous.match);
    assert.ok(direction.match>=48&&direction.match<=96);
    assert.ok(direction.reasons.every(x=>!/passed wcag|verified audit|user testing successful/i.test(x)));
    assert.ok(direction.reasons.some(x=>x.includes('private feedback signal')));
  }
});
test('Latest feedback replaces prior decision within project, without touching other projects or owners',()=>{
  const events=[
    {owner:'alice',id:'p1',style:'glass',reaction:'like'},
    {owner:'alice',id:'p1',style:'glass',reaction:'dislike'},
    {owner:'alice',id:'p2',style:'glass',reaction:'like'},
    {owner:'bob',id:'p1',style:'glass',reaction:'like'},
    {owner:'alice',id:'p1',style:'minimal',reaction:'edit'},
  ];
  const latest=latestFeedbackChoices(events);
  assert.equal(latest.length,4);
  assert.equal(latest.find(x=>x.owner==='alice'&&x.id==='p1'&&x.style==='glass').reaction,'dislike');
  assert.equal(latest.filter(x=>x.reaction==='like').length,2);
});
test('Changing a vote reverses previous signal and identical repeats cannot drift',()=>{
  let p=normalizeProfile({});
  p=learnFeedbackTransition(p,'minimal','like',null);
  assert.equal(p.styleWeights.minimal,1);
  for(let i=0;i<100;i++)p=learnFeedbackTransition(p,'minimal','like','like');
  assert.equal(p.styleWeights.minimal,1);
  p=learnFeedbackTransition(p,'minimal','dislike','like');
  assert.equal(p.styleWeights.minimal,-1);
  p=learnFeedbackTransition(p,'minimal','edit','dislike');
  assert.equal(p.styleWeights.minimal,0);
  assert.deepEqual(preferenceHints(normalizeProfile({})),[],'No invented learned default preferences');
});
test('Public cohort range gate never returns exact small numbers',()=>{
  for(const n of [0,1,4])assert.equal(visitorCohortBand(n),null);
  for(const n of [5,6,9])assert.equal(visitorCohortBand(n),'5–9');
  for(const n of [10,13,24])assert.equal(visitorCohortBand(n),'10–24');
  for(const n of [25,35,500])assert.equal(visitorCohortBand(n),'25+');
});
