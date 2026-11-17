import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend} from '../design-engine.mjs';
import {buildDesignBrief,deterministicDesignPrompt,createDesignPrompt} from '../design-intelligence.mjs';
import {analyzeProject} from '../project-intelligence.mjs';
import {buildRequirementTrace,formatRequirementTrace,formatRoleNavigation,
  formatPageInteractionContracts,reviewRequirementTrace} from '../design-traceability.mjs';

const CASES=[
  {
    name:'multi-role education',
    brief:'Design an accessible college learning platform for students, teachers, and administrators with courses, assignments, AI tutor, calendar, progress reports, notification center, user profiles and settings. Must preserve existing backend and work on low-power mobile devices.',
    mustHave:['assignments','tutor','calendar','progress','courses','notifications','profile','settings'],
    mustRoles:['Students / learners','Teachers / educators','Administrators'],
  },
  {
    name:'healthcare',
    brief:'Design a mobile healthcare experience for patients and doctors with appointments, notifications, user profiles, messages and accessibility. Keep patient information private.',
    mustHave:['calendar','notifications','profile','messages'],
    mustRoles:['Patients','Care providers'],
  },
  {
    name:'commerce',
    brief:'Design an ecommerce shopping platform for customers with product catalog, checkout, payments, search and user profiles. Support mobile responsive screens.',
    mustHave:['commerce','payments','search','profile'],
    mustRoles:['Customers'],
  },
  {
    name:'portfolio',
    brief:'Create a creative portfolio website for designers featuring case studies, a contact page, and mobile responsive typography.',
    mustHave:['portfolio'],
    mustRoles:['Creators / designers'],
  },
  {
    name:'AI product',
    brief:'Design an AI agent workspace for teams with messages, search, project history, analytics and a simple keyboard accessible dark mode.',
    mustHave:['messages','search','progress'],
    mustRoles:['Team members'],
  },
  {
    name:'unspecified app',
    brief:'Create an original application for users with an elegant and expressive visual direction.',
    mustHave:[],
    mustRoles:[],
  },
];
test('09A: every explicit module, role and constraint maps to one requirement trace in all contexts',()=>{
  for(const fixture of CASES){
    const analysis=analyzeProject(fixture.brief),trace=buildRequirementTrace(analysis);
    const ids=trace.rows.map(x=>x.id);
    assert.equal(new Set(ids).size,ids.length,fixture.name+' must not have duplicate trace identities');
    for(const id of fixture.mustHave)
      assert.ok(trace.rows.some(row=>row.id==='F-'+id),fixture.name+' missing module '+id);
    for(const role of fixture.mustRoles)
      assert.ok(trace.rows.some(row=>row.type==='role'&&row.label===role),fixture.name+' missing role '+role);
    assert.equal(trace.count.constraints,analysis.constraints.length);
    assert.equal(trace.count.decisions,analysis.explicitDecisions.length);
    assert.ok(trace.rows.every(row=>row.acceptance&&row.page&&row.notes),
      fixture.name+' every requirement needs a proposed page, acceptance criterion and uncertainty label');
  }
});
test('09A: actual Generate and Fusion text passes the independently parsed trace coverage gate',()=>{
  for(const fixture of CASES){
    const p={brief:fixture.brief,recommendations:recommend(fixture.brief)};
    for(const mode of ['generate','fusion']){
      const styles=mode==='generate'?['glass']:['glass','minimal'];
      const b=buildDesignBrief({project:p,mode,styles});
      const out=deterministicDesignPrompt({project:p,mode,styles});
      const review=reviewRequirementTrace(out,b.trace);
      assert.equal(review.passed,true,fixture.name+' '+mode+': '+review.missing.join(', '));
      assert.equal(review.mapped,review.total);
      assert.equal(review.count.features,b.analysis.features.length);
      assert.match(out,/ROLE-SPECIFIC NAVIGATION & PERMISSION STATES/);
      assert.match(out,/PER-PAGE INTERACTION CONTRACTS/);
      assert.match(out,/TESTABLE|Acceptance criterion/i);
      assert.match(out,/phone|mobile/);
      assert.match(out,/reduced-motion/);
      assert.match(out,/not.*(?:confirmed|verified|implemented|certified)/i,
        'Proposed guidance must not claim verified permissions or completed audits');
      assert.doesNotMatch(out,/(?:^|\n)\s*(?:import React|export default function App)/);
      for(const id of fixture.mustHave)assert.ok(out.includes('[F-'+id+']'),fixture.name+' missing '+id);
    }
  }
});
test('09A: coverage reviewer fails when a module, role or its structured section disappears',()=>{
  const brief=CASES[0].brief;
  const p={brief,recommendations:recommend(brief)};
  const b=buildDesignBrief({project:p,mode:'generate'});
  const complete=deterministicDesignPrompt({project:p,mode:'generate'});
  assert.equal(reviewRequirementTrace(complete,b.trace).passed,true);
  const missingModule=complete.replace('[F-notifications]','[OMITTED-NOTIFICATIONS]');
  assert.equal(reviewRequirementTrace(missingModule,b.trace).passed,false);
  assert.ok(reviewRequirementTrace(missingModule,b.trace).missing.includes('F-notifications'));
  const missingRole=complete.replace('[R-administrators]','[OMITTED-ROLE]');
  assert.ok(reviewRequirementTrace(missingRole,b.trace).missing.includes('R-administrators'));
  const missingSection=complete.replace('REQUIREMENT TRACEABILITY MATRIX','UNSTRUCTURED NOTES');
  assert.equal(reviewRequirementTrace(missingSection,b.trace).passed,false);
});
test('09A: unspecified user intent stays explicitly provisional instead of inventing confirmed people or capabilities',()=>{
  const analysis=analyzeProject(CASES.at(-1).brief);
  const trace=buildRequirementTrace(analysis),t=formatRequirementTrace(trace);
  assert.equal(trace.missingAudience,true);
  assert.equal(trace.missingFeatures,true);
  assert.match(t,/\[QUESTION-AUDIENCE\]/);
  assert.match(t,/\[QUESTION-PRIMARY-TASK\]/);
  assert.match(formatRoleNavigation(analysis),/not confirmed/i);
  assert.match(formatPageInteractionContracts(analysis),/proposed/i);
});
test('09B: successful optional AI enhancement and provider failure share the exact same trace coverage',async()=>{
  const p={brief:CASES[0].brief,recommendations:recommend(CASES[0].brief)};
  const fallback=await createDesignPrompt({project:p,mode:'generate',env:{},styles:['minimal']});
  assert.equal(fallback.source,'guide');
  assert.equal(fallback.review.traceability.passed,true);
  assert.equal(fallback.review.traceability.mapped,fallback.review.traceability.total);
  assert.equal(fallback.review.traceability.count.roles,3);
  const aiInsight='Minimal SaaS grounds the student assignment workflow in predictable navigation. Glass UI adds optional atmosphere to the progress area without translucent labels. Creative UI lends expressive visual hierarchy to course summaries while preserving accessibility, tutor assistance, calendar, notification center, profile and administrator information boundaries. Avoid feature overload and low-powered-device animation penalties.';
  const fakeRequest=async()=>({ok:true,json:async()=>({choices:[{message:{content:aiInsight},finish_reason:'stop'}]})});
  const enhanced=await createDesignPrompt({project:p,mode:'generate',styles:['minimal'],
    env:{OPENROUTER_API_KEY:'mock-only',AI_PRIMARY_PROVIDER:'openrouter'},request:fakeRequest});
  assert.equal(enhanced.review.traceability.passed,true);
  assert.equal(enhanced.review.traceability.total,fallback.review.traceability.total);
  assert.equal(enhanced.review.traceability.mapped,fallback.review.traceability.mapped);
  assert.doesNotMatch(JSON.stringify(enhanced),/mock-only/);
});
test('09C: preserving backend and changed refinement stays explicit without turning prompts into executable code',()=>{
  const brief=CASES[0].brief;
  const p={brief,recommendations:recommend(brief)};
  const output=deterministicDesignPrompt({project:p,mode:'fusion',styles:['creative','minimal'],
    refinement:'Keep existing API integrations, increase clarity of the student calendar and add a warm accent only.'});
  assert.match(output,/Keep existing API integrations/i);
  assert.match(output,/Preserve existing backend/i);
  assert.match(output,/calendar/i);
  assert.match(output,/DESIGN PROMPT ONLY/);
  assert.match(output,/Never discard approved functional requirements/);
});
