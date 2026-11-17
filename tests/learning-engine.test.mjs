import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PERSONALIZATION,normalizeProfile,persistableWeights,effectivePreferences,
  learnStyle,validatePreferenceChanges,applyPreferenceChanges,resetPreferenceLearning,preferenceHints
} from '../learning-engine.mjs';
import {recommend} from '../design-engine.mjs';

test('legacy per-visitor profiles remain compatible with the new JSONB preference namespace',()=>{
  const legacy=normalizeProfile({styleWeights:{creative:3,minimal:-2},globalOptIn:true});
  assert.deepEqual(legacy.styleWeights,{minimal:-2,creative:3});
  assert.deepEqual(legacy.personalization,DEFAULT_PERSONALIZATION);
  const persisted=persistableWeights(legacy);
  assert.equal(persisted._personalization.enabled,true);
  assert.equal(persisted.creative,3);
  const restored=normalizeProfile({styleWeights:persisted,globalOptIn:true});
  assert.deepEqual(restored,legacy);
});
test('feedback learns privately, clamps weight and does not learn when disabled',()=>{
  let p=normalizeProfile({});
  for(let i=0;i<10;i++)p=learnStyle(p,'minimal','like');
  assert.equal(p.styleWeights.minimal,5);
  p=learnStyle(p,'minimal','dislike');
  assert.equal(p.styleWeights.minimal,4);
  p=learnStyle(p,'minimal','edit');
  assert.equal(p.styleWeights.minimal,4);
  p=applyPreferenceChanges(p,{enabled:false});
  assert.equal(p.globalOptIn,false);
  assert.equal(learnStyle(p,'creative','like').styleWeights.creative,undefined);
  assert.deepEqual(effectivePreferences(p).styleWeights,{});
  const brief='Create a general digital website for teams';
  const base=recommend(brief,{});
  const disabled=recommend(brief,effectivePreferences(p));
  assert.deepEqual(disabled.designs.map(x=>x.match),base.designs.map(x=>x.match));
});
test('new explicit requirements remain stronger than private style preference signals',()=>{
  const prefs=applyPreferenceChanges(normalizeProfile({}),{styleWeights:{minimal:5,glass:-5}});
  const directions=recommend('Build a futuristic immersive 3D AI product',prefs);
  assert.ok(directions.designs.find(d=>d.id==='glass').reasons.length);
  assert.ok(directions.designs.every(d=>d.scoring.includes('Heuristic')));
});
test('preference corrections are strictly validated and no unknown metadata is accepted',()=>{
  for(const bad of [
    null,[],{enabled:'false'},{motion:'extreme'},{density:7},{contrast:'magic'},
    {styleWeights:{minimal:900}},{styleWeights:{glass:2.4}},{styleWeights:{other:5}},
    {styleWeights:[]},{__proto_marker:'ignored'},
  ])assert.throws(()=>validatePreferenceChanges(bad));
  const profile=applyPreferenceChanges(normalizeProfile({}),{
    motion:'minimal',density:'compact',colorMood:'warm',contrast:'high',
    styleWeights:{creative:3}
  });
  assert.equal(profile.personalization.motion,'minimal');
  assert.equal(profile.styleWeights.creative,3);
  assert.ok(preferenceHints(profile).some(x=>x.includes('minimal')));
  assert.ok(preferenceHints(profile).some(x=>x.includes('warm')));
  assert.deepEqual(preferenceHints(normalizeProfile({})),[],'Defaults must never masquerade as learned choices');
});
test('reset clears learning and opt-in without deleting the visitor project data',()=>{
  const original=normalizeProfile({styleWeights:{
    minimal:5,_personalization:{enabled:false,motion:'expressive',colorMood:'warm'}
  },globalOptIn:true});
  const reset=resetPreferenceLearning(original);
  assert.deepEqual(reset.styleWeights,{});
  assert.equal(reset.globalOptIn,false);
  assert.equal(reset.personalization.enabled,false);
  assert.equal(reset.personalization.motion,'balanced');
});
