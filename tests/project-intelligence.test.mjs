import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProject,compareDirections,planFusion,qualityReview,inferProjectCategory} from '../project-intelligence.mjs';
import {STYLES} from '../design-engine.mjs';
const brief='Build a student dashboard with AI tutor, assignments, progress and calendar. Must keep existing backend and support mobile, keyboard navigation and reduced motion.';
test('project analysis extracts explicit roles, features and constraints',()=>{
 const a=analyzeProject(brief);
 assert.equal(a.category,'Education');
 assert.ok(a.audience.includes('Students / learners'));
 for(const id of ['assignments','tutor','calendar','progress'])assert.ok(a.features.some(f=>f.id===id));
 assert.ok(a.constraints.some(c=>c.includes('backend')));
 assert.ok(a.pages.some(p=>p.includes('Calendar')));
 assert.equal(a.workflows[0].steps.length,4);
});
test('underspecified brief stays uncertain rather than inventing requirements',()=>{
 const a=analyzeProject('Create an original app for people');
 assert.equal(a.features.length,0);assert.equal(a.evidenceLevel,'partly-inferred');
 assert.ok(a.openQuestions.some(q=>q.includes('primary user')));
});
test('category matching does not mistake email for AI',()=>{
 assert.equal(inferProjectCategory('Create an email composition interface'),'Digital product');
 assert.equal(inferProjectCategory('Make an AI agent dashboard'),'AI Product');
});
test('explainable ranking accounts for task complexity, accessibility and private preference',()=>{
 const a=analyzeProject(brief);
 const ranks=compareDirections(a,STYLES,{styleWeights:{glass:5}});
 assert.equal(ranks[0].id,'minimal');
 assert.ok(ranks.every(x=>x.match>=48&&x.match<=96&&x.tradeoff));
 assert.ok(ranks.find(x=>x.id==='glass').reasons.some(x=>x.includes('blurs')));
});
test('Fusion picks context-fitting structure independent of click order',()=>{
 assert.equal(planFusion(analyzeProject(brief),[STYLES[1],STYLES[0]]).anchor,'Minimal SaaS');
});
test('quality review flags incomplete prompts and disallowed application code',()=>{
 assert.ok(qualityReview('Very short',{requiredStyles:['Minimal SaaS']}).missing.includes('length'));
 assert.equal(qualityReview(('import React from "react";\n').repeat(100),{mode:'fusion'}).checks.promptOnly,false);
});
