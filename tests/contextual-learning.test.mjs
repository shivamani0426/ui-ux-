import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePrivateLearning,contextForCategory,publicLearningSummary,
  verifiedCohortBand,VERIFIED_COHORT_MIN} from '../contextual-learning.mjs';
import {recommend} from '../design-engine.mjs';
import {normalizeProfile,effectivePreferences} from '../learning-engine.mjs';

const vote=(projectId,category,style,reaction,createdAt)=>
  ({projectId,category,style,reaction,createdAt});

test('12A: one like or repeated clicks on the same project never become an invented strong preference',()=>{
 const rows=[
  vote('p1','Education','minimal','like','2026-01-01T00:00:00Z'),
  vote('p1','Education','minimal','like','2026-02-01T00:00:00Z'),
  vote('p1','Education','minimal','like','2026-03-01T00:00:00Z')
 ];
 const model=derivePrivateLearning(rows);
 const evidence=contextForCategory(model,'Education');
 assert.equal(evidence.adjustments.minimal,0);
 assert.equal(evidence.evidence.minimal.support,1);
 assert.equal(evidence.evidence.minimal.confidence,'insufficient');
 assert.equal(model.projectChoices,1);
 assert.equal(publicLearningSummary(model).length,0);
});

test('12A: two distinct projects begin a conservative, category-specific signal',()=>{
 const model=derivePrivateLearning([
  vote('p1','Education','creative','like'),
  vote('p2','Education','creative','like'),
  vote('p3','Healthcare','creative','dislike'),
  vote('p4','Education','minimal','edit')
 ]);
 const education=contextForCategory(model,'Education');
 const healthcare=contextForCategory(model,'Healthcare');
 assert.equal(education.adjustments.creative,2);
 assert.equal(healthcare.adjustments.creative,0,'One contrary case remains insufficient');
 assert.equal(education.evidence.creative.support,2);
 assert.equal(education.evidence.creative.confidence,'low');
 assert.equal(education.adjustments.minimal,0,'Requested edits provide no positive style votes');
 assert.ok(publicLearningSummary(model).some(x=>x.category==='Education'));
 assert.ok(!publicLearningSummary(model).some(x=>x.category==='Healthcare'));
});

test('12B: last feedback per project/style replaces earlier reactions, and contradictory evidence shrinks to zero',()=>{
 const model=derivePrivateLearning([
  vote('p1','SaaS','glass','like','2026-01-01'),
  vote('p1','SaaS','glass','dislike','2026-02-01'),
  vote('p2','SaaS','glass','like','2026-02-01'),
  vote('p3','SaaS','glass','dislike','2026-03-01'),
  vote('p4','SaaS','glass','like','2026-03-01'),
 ]);
 const v=contextForCategory(model,'SaaS');
 assert.equal(v.evidence.glass.support,4);
 assert.equal(v.evidence.glass.likes,2);
 assert.equal(v.evidence.glass.dislikes,2);
 assert.equal(v.adjustments.glass,0);
 assert.equal(v.active,false);
 assert.equal(v.evidence.glass.confidence,'low', 'Conflicting opinions must not receive medium confidence');
});

test('12B: low-confidence feedback never outweighs an explicit style or accessibility instruction',()=>{
 const brief='Create an accessible minimal education portal for teachers with assignments and student progress.';
 const model=derivePrivateLearning(Array.from({length:22},(_,i)=>
  vote('id-'+i,'Education','glass','like')));
 const context=contextForCategory(model,'Education');
 assert.equal(context.adjustments.glass,3);
 const base=recommend(brief,effectivePreferences(normalizeProfile({})));
 const prefs={...effectivePreferences(normalizeProfile({})),contextLearning:context};
 const contextResult=recommend(brief,prefs);
 assert.ok(contextResult.designs.find(s=>s.id==='glass').match>=base.designs.find(s=>s.id==='glass').match);
 assert.equal(contextResult.designs[0].id,'minimal',
   'Explicit minimal+accessible education requirements must outweigh glass feedback');
 const glass=contextResult.designs.find(s=>s.id==='glass');
 assert.equal(glass.personalization.categoryEvidence.adjustment,3);
 assert.ok(glass.scoreFactors.some(f=>f.source==='private category evidence'));
 assert.equal(glass.match,Math.max(48,Math.min(96,glass.scoreFactors.reduce((sum,f)=>sum+f.points,0))));
});

test('12B: paused personal learning cannot influence recommendations or expose unconfirmed memories',()=>{
 const model=derivePrivateLearning([
   vote('a','Education','creative','like'),vote('b','Education','creative','like')
 ]);
 const paused=contextForCategory(model,'Education',false);
 assert.deepEqual(paused.adjustments,{minimal:0,glass:0,creative:0});
 assert.equal(paused.active,false);
 const profile=normalizeProfile({personalization:{enabled:false},styleWeights:{creative:5}});
 const prefs=effectivePreferences(profile);
 const brief='Design a plain education dashboard for learners';
 const a=recommend(brief,prefs);
 const b=recommend(brief,{...prefs,contextLearning:paused});
 assert.deepEqual(a.designs.map(x=>x.match),b.designs.map(x=>x.match));
});

test('12C: category model is deterministic, bounded and contains no private project IDs or feedback details',()=>{
 const rows=Array.from({length:50},(_,i)=>vote('PRIVATE_PROJECT_IDENTIFIER_'+i,
   'Portfolio','creative',i%10===0?'dislike':'like'));
 const a=derivePrivateLearning(rows),b=derivePrivateLearning([...rows]);
 assert.deepEqual(a,b);
 const out=JSON.stringify(publicLearningSummary(a));
 assert.ok(!out.includes('PRIVATE_PROJECT_IDENTIFIER'));
 assert.ok(!out.includes('visitor_id'));
 const value=contextForCategory(a,'Portfolio');
 assert.ok(value.adjustments.creative<=3);
 assert.ok(value.evidence.creative.support===50);
 assert.equal(value.evidence.creative.confidence,'high');
 assert.deepEqual(contextForCategory(a,'Unknown category').adjustments,{minimal:0,glass:0,creative:0});
});

test('12D: public trends cannot be released below ten distinct authenticated accounts',()=>{
 assert.equal(VERIFIED_COHORT_MIN,10);
 for(let i=0;i<10;i++)assert.equal(verifiedCohortBand(i),null);
 assert.equal(verifiedCohortBand(10),'10–24');
 assert.equal(verifiedCohortBand(24),'10–24');
 assert.equal(verifiedCohortBand(25),'25–49');
 assert.equal(verifiedCohortBand(500),'50+');
});
