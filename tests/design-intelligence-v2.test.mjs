import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProject,compareDirections,buildDecisionReport,planFusion,inferProjectCategory,inspectAdvisorScope} from '../project-intelligence.mjs';
import {STYLES,recommend,exportPrompt} from '../design-engine.mjs';
import {buildDesignBrief,deterministicDesignPrompt,createDesignPrompt} from '../design-intelligence.mjs';
import {buildRequirementTrace,reviewRequirementTrace} from '../design-traceability.mjs';

test('11A: explicit exclusions never turn into requested features or invented pages',()=>{
 const brief='Build an ecommerce product catalog for customers with search and filters, but no checkout or payments. Do not add chat or messaging.';
 const analysis=analyzeProject(brief);
 assert.equal(analysis.category,'Commerce');
 assert.ok(analysis.features.some(f=>f.id==='commerce'), 'Product browsing is still in scope');
 assert.ok(analysis.features.some(f=>f.id==='search'));
 for(const id of ['checkout','payments','messages']){
   assert.ok(!analysis.features.some(f=>f.id===id),id+' must not be recommended');
   assert.ok(analysis.excludedFeatures.some(f=>f.id===id),id+' must be explicitly out of scope');
 }
 assert.ok(!analysis.pages.some(p=>/checkout|transaction/i.test(p)));
 const advice=recommend(brief);
 const report=advice.decision;
 assert.equal(report.version,2);
 assert.ok(report.evidence.excludedCapabilities.some(v=>/Cart and checkout/i.test(v)));
 const prompt=exportPrompt({brief,recommendations:advice},['minimal']);
 assert.match(prompt,/EXPLICITLY OUT OF SCOPE — DO NOT ADD/);
 assert.match(prompt,/Cart and checkout/);
});

test('11A: late explicit refinement replaces an earlier affirmative request, but not original text',()=>{
 const brief='Create a student portal for students with assignments, messaging, and calendar.';
 const initial=recommend(brief);
 assert.ok(initial.analysis.features.some(f=>f.id==='messages'));
 const refined=recommend(brief,{},undefined,{refinement:'Keep assignments and calendar, remove messaging. Prioritize mobile keyboard accessibility.'});
 assert.equal(refined.brief,brief);
 assert.ok(refined.analysis.features.some(f=>f.id==='assignments'));
 assert.ok(refined.analysis.features.some(f=>f.id==='calendar'));
 assert.ok(!refined.analysis.features.some(f=>f.id==='messages'));
 assert.ok(refined.analysis.excludedFeatures.some(f=>f.id==='messages'));
 assert.ok(refined.analysis.constraints.some(c=>/Accessible/.test(c)));
 assert.ok(refined.refinement.includes('remove messaging'));
 const b=buildDesignBrief({project:{brief,recommendations:refined},mode:'fusion',styles:['minimal','glass']});
 assert.ok(b.analysis.excludedFeatures.some(f=>f.id==='messages'));
 const prompt=deterministicDesignPrompt({project:{brief,recommendations:refined},mode:'fusion',styles:['minimal','glass']});
 assert.match(prompt,/Saved project refinement: Keep assignments/);
 assert.match(prompt,/Do not propose Messages and conversations/);
 assert.match(prompt,/\[X-messages\]/);
 assert.equal(reviewRequirementTrace(prompt,b.trace).passed,true);
 assert.equal(b.trace.count.exclusions,1);
});

test('11A: the tool never converts an instruction to preserve a module into its exclusion',()=>{
 const analysis=analyzeProject("Build a student app, don't remove assignments, keep AI tutor, avoid glass UI.");
 assert.ok(analysis.features.some(f=>f.id==='assignments'));
 assert.ok(analysis.features.some(f=>f.id==='tutor'));
 assert.ok(!analysis.excludedFeatures.some(f=>f.id==='assignments'));
 assert.ok(!analysis.requestedStyles.includes('glass'));
});

test('11A: explicit domain clues outrank generic dashboard words',()=>{
 assert.equal(inferProjectCategory('Build an AI security analytics dashboard with agents'),'AI Product');
 assert.equal(inferProjectCategory('Build a student learning dashboard with school progress'),'Education');
 assert.equal(inferProjectCategory('Build a SaaS dashboard for business analytics'),'SaaS');
 assert.equal(inferProjectCategory('Build a simple website without shopping'),'Digital product');
 assert.equal(inferProjectCategory('Create an email composition interface'),'Digital product');
});

test('11B: explainable scoring factors reconcile with displayed bounded heuristics',()=>{
 const brief='Create an accessible student course dashboard with assignments and notifications for mobile low-power devices.';
 const output=recommend(brief,{styleWeights:{glass:4,creative:1}});
 assert.equal(output.designs.length,3);
 assert.equal(output.designs[0].id,'minimal');
 assert.equal(output.decision.primaryStyle.id,'minimal');
 for(const choice of output.designs){
   assert.ok(choice.scoreFactors.length>=2);
   const raw=choice.scoreFactors.reduce((sum,f)=>sum+f.points,0);
   assert.equal(choice.match,Math.max(48,Math.min(96,raw)),
     choice.name+' score breakdown must match visible ranking');
   assert.ok(choice.scoreFactors.every(f=>f.source&&Number.isFinite(f.points)));
   assert.equal(choice.evidence.category,'Education');
   assert.equal(choice.mitigations.length,2);
   assert.match(choice.scoring,/Heuristic/);
 }
 assert.match(output.decision.decisionRules.join(' '),/Explicit requirements and exclusions/);
 assert.ok(output.decision.evidence.requestedFeatures.some(f=>/Assignments/.test(f)));
 assert.match(planFusion(output.analysis,STYLES).rationale,/based on the brief/);
});

test('11B: generate and fusion include full decision analysis and exclusions, even when AI fails',async()=>{
 const brief='Design a healthcare app for patients with calendar and notifications, but no chat. Must preserve existing backend and support mobile.';
 const project={brief,recommendations:recommend(brief)};
 for(const mode of ['generate','fusion']){
   const value=await createDesignPrompt({project,mode,styles:['minimal','glass'],env:{},
     request:()=>{throw Error('No external request is allowed');}});
   assert.equal(value.source,'guide');
   assert.equal(value.review.traceability.passed,true);
   assert.match(value.prompt,/DECISION FACTORS AND SCOPE RISKS/);
   assert.match(value.prompt,/\[X-messages\]/);
   assert.match(value.prompt,/Explicitly excluded/i);
   assert.match(value.prompt,/Never override an explicitly excluded capability/);
   assert.match(value.prompt,/Preserve existing backend/);
   assert.doesNotMatch(value.prompt,/(?:^|\n)\s*import React/);
 }
});

test('11C: missing evidence is labeled provisional and options remain user-controlled',()=>{
 const analysis=analyzeProject('Make a beautiful app');
 assert.equal(analysis.confidence,'low');
 const ranked=compareDirections(analysis,STYLES);
 const decision=buildDecisionReport(analysis,ranked);
 assert.equal(decision.status,'low');
 assert.ok(decision.evidence.unconfirmed.some(q=>/primary user|most important task/i.test(q)));
 assert.ok(ranked.every(item=>item.comparisonSummary.includes('provisional')));
 const followup=analyzeProject('Create a healthcare portal for patients and nurses without administrators.');
 assert.ok(followup.audience.includes('Patients'));
 assert.ok(!followup.audience.includes('Administrators'));
});

test('11D: optional model replies cannot quietly reintroduce excluded project functionality',()=>{
  const analysis=analyzeProject('Build a student dashboard with assignments and calendar, but do not add chat, checkout or payments.');
  assert.ok(['messages','checkout','payments'].every(id=>
    analysis.excludedFeatures.some(f=>f.id===id)));
  const unsafe='Build a chat inbox so students can message each other. Add checkout to the navigation and enable payments.';
  const review=inspectAdvisorScope(unsafe,analysis);
  assert.equal(review.passed,false);
  assert.ok(review.conflicting.includes('messages'));
  assert.ok(review.conflicting.includes('checkout'));
  assert.ok(review.conflicting.includes('payments'));
  const safe='Use a focused assignment list, calendar review, keyboard-friendly navigation and clear loading states.';
  assert.equal(inspectAdvisorScope(safe,analysis).passed,true);
  assert.equal(inspectAdvisorScope(unsafe,analyzeProject('Design a blank interface')).passed,true,
    'Scope guard must only enforce exclusions the user actually gave');
  assert.match(review.warning,/not certify/i);
});

test('11D: a polished provider insight cannot override an explicit no-chat constraint',async()=>{
 const brief='Design a student dashboard with calendar and assignments. Do not add chat.';
 const project={brief,recommendations:recommend(brief)};
 const generated='Minimal SaaS supports accessible assignments and calendar overview. Glass UI adds depth to optional analytics. Creative UI provides expressive but readable learning cards. Add a chat inbox so students can message teachers; include chat as an extra sidebar module. Offer keyboard navigation, loading states, and mobile responsive cards while showing calendar reminders.';
 const mock=async()=>({ok:true,json:async()=>({choices:[{message:{content:generated},finish_reason:'stop'}]})});
 const value=await createDesignPrompt({project,mode:'generate',styles:['minimal'],
   env:{OPENROUTER_API_KEY:'fictional-test-key'},request:mock});
 assert.equal(value.source,'guide');
 assert.equal(value.review.reason[0],'insight-scope-conflict');
 assert.equal(value.review.traceability.passed,true);
 assert.match(value.prompt,/\[X-messages\]/);
 assert.doesNotMatch(value.prompt,/Add a chat inbox/);
});
