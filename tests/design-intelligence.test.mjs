import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend} from '../design-engine.mjs';
import {buildDesignBrief,deterministicDesignPrompt,createDesignPrompt} from '../design-intelligence.mjs';

const brief='Build a modern college student dashboard with course progress and responsive analytics.';
const project={id:'some-id',brief,recommendations:recommend(brief)};
const refs=[
  {id:'site1',name:'Studio reference',site:'https://example.com',category:'Education',tags:['layout','editorial'],styles:['minimal']},
];
test('Generate emits exactly three original style directions and a copyable detailed prompt',()=>{
  const text=deterministicDesignPrompt({project,mode:'generate',styles:['minimal'],preferences:{styleWeights:{minimal:2}}});
  assert.match(text,/ORIGINAL UI\/UX GENERATION SPECIFICATION/);
  for(const style of ['Minimal SaaS','Glass UI','Creative UI'])assert.match(text,new RegExp(style));
  assert.match(text,/DIRECTION 3/);
  assert.match(text,/INFORMATION ARCHITECTURE/);
  assert.match(text,/ACCESSIBILITY/);
  assert.match(text,/DESIGN PROMPT ONLY/);
  assert.ok(text.length>1800);
});
test('Fusion synthesizes saved reference metadata and does not invent a screenshot audit',()=>{
  const info=buildDesignBrief({project,mode:'fusion',styles:['minimal','glass'],references:refs});
  assert.equal(info.selected.length,2);
  assert.equal(info.namedRefs[0].name,'Studio reference');
  const text=deterministicDesignPrompt({project,mode:'fusion',styles:['minimal','glass'],references:refs});
  assert.match(text,/DESIGN FUSION SPECIFICATION/);
  assert.match(text,/FUSION STRATEGY/);
  assert.match(text,/Studio reference/);
  assert.match(text,/not a live visual audit/i);
  assert.doesNotMatch(text,/DIRECTION 3/);
});
test('AI prompt can replace fallback without exposing secrets, in correct mode',async()=>{
  const result=await createDesignPrompt({
    project,mode:'generate',styles:['minimal'],env:{GEMINI_API_KEY:'test',AI_PRIMARY_PROVIDER:'gemini'},
    request:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:
      'Product purpose and audience. Information architecture and page plan. Desktop and mobile responsive layouts. Accessibility and keyboard support. UI components, buttons and navigation. Acceptance checklist. Minimal SaaS, Glass UI, Creative UI. Course progress tracking and responsive analytics. Each distinct direction has appropriate constraints and implementation guidance. '.repeat(8)}]}}]})})
  });
  assert.equal(result.source,'ai');assert.equal(result.provider,'gemini');
  assert.ok(result.prompt.length>500);
  assert.equal(result.review.passed,true);
  assert.equal(result.review.usedFallback,false);
  assert.equal(result.composition,'structured-plus-ai');
  assert.match(result.prompt,/AI CREATIVE REFINEMENTS/);
  assert.match(result.prompt,/QUALITY & ACCEPTANCE CHECKLIST/);
});
test('Short AI content or exhausted providers preserve deterministic quality',async()=>{
  const result=await createDesignPrompt({
    project,mode:'fusion',styles:['glass'],env:{GEMINI_API_KEY:'test',AI_PRIMARY_PROVIDER:'gemini'},
    request:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Too short'}]}}]})})
  });
  assert.equal(result.source,'guide');
  assert.ok(result.prompt.length>1800);
});
test('Invalid mode is rejected and malformed reference URLs are never exported',async()=>{
  await assert.rejects(()=>createDesignPrompt({project,mode:'unknown',styles:['minimal'],env:{}}),/Invalid design mode/);
  const prompt=deterministicDesignPrompt({project,mode:'fusion',styles:['minimal'],references:[{id:'bad',name:'Unsafe',site:'javascript:alert(1)',category:'Unknown',tags:[],styles:[]}]});
  assert.doesNotMatch(prompt,/javascript:alert/);
});

test('long but structurally empty AI text is rejected in favor of a complete prompt',async()=>{
  const result=await createDesignPrompt({
    project,mode:'generate',styles:['minimal'],env:{OPENROUTER_API_KEY:'fake-key'},
    request:async()=>({ok:true,json:async()=>({choices:[{message:{content:'Sounds great! '.repeat(140)}}]})})
  });
  assert.equal(result.source,'guide');
  assert.ok(result.review.passed);
  assert.equal(result.review.usedFallback,true);
  assert.ok(result.review.reason.includes('insight-missing-style'));
  assert.equal(result.composition,'structured');
});
test('specific student modules and a refinement survive in the generated specification',()=>{
  const p={id:'x',brief:'Build a student dashboard with assignments, calendar and AI tutor. Must preserve existing backend.',
    recommendations:recommend('Build a student dashboard with assignments, calendar and AI tutor. Must preserve existing backend.')};
  const output=deterministicDesignPrompt({project:p,mode:'generate',styles:['glass'],
    refinement:'Make mobile navigation simpler but keep the assignment workflow.'});
  assert.match(output,/Calendar and schedule/);
  assert.match(output,/AI tutor/);
  assert.match(output,/Assignments and tasks/);
  assert.match(output,/Preserve existing backend/);
  assert.match(output,/Make mobile navigation simpler/);
});
test('Fusion chooses a context-fitting structural anchor rather than first selected style',()=>{
  const p={id:'x',brief:'Build a student dashboard with assignments and accessible course progress',
    recommendations:recommend('Build a student dashboard with assignments and accessible course progress')};
  const b=buildDesignBrief({project:p,mode:'fusion',styles:['glass','minimal']});
  assert.equal(b.fusion.anchor,'Minimal SaaS');
  const out=deterministicDesignPrompt({project:p,mode:'fusion',styles:['glass','minimal']});
  assert.match(out,/Minimal SaaS as the structural anchor/);
});

test('a plausible AI prompt that omits a confirmed module cannot replace the complete specification',async()=>{
 const briefing='Design a student dashboard with assignments, calendar and AI tutor. Must preserve existing backend.';
 const p={brief:briefing,recommendations:recommend(briefing)};
 const looksComplete=('Audience and information architecture with page plan. Responsive mobile navigation, accessibility and keyboard input. Components, buttons, acceptance checklist. Minimal SaaS Glass UI Creative UI. ').repeat(9);
 const output=await createDesignPrompt({project:p,mode:'generate',styles:['minimal'],
   env:{OPENROUTER_API_KEY:'test'},
   request:async()=>({ok:true,json:async()=>({choices:[{message:{content:looksComplete}}]})})
 });
 assert.equal(output.source,'guide');
 assert.ok(output.review.reason.includes('insight-not-project-specific'));
 assert.equal(output.review.passed,true);
});

test('Fusion layers an original AI insight without removing complete required specifications',async()=>{
  const briefing='Design a student learning dashboard with assignments, AI tutor and calendar. Must preserve existing backend.';
  const p={brief:briefing,recommendations:recommend(briefing)};
  const insight='Minimal SaaS is the structural anchor for predictable course task navigation. Give the AI tutor an always-available but unobtrusive entry point, and borrow subtle Glass UI layering only for optional learning insights. Preserve the existing backend contract and accessible focus states; avoid transparent text backgrounds and motion-heavy forms.';
  const result=await createDesignPrompt({project:p,mode:'fusion',styles:['glass','minimal'],
    env:{OPENROUTER_API_KEY:'fake'},request:async()=>({ok:true,json:async()=>({choices:[{message:{content:insight}}]})})
  });
  assert.equal(result.source,'ai');
  assert.equal(result.composition,'structured-plus-ai');
  assert.equal(result.provider,'openrouter');
  assert.match(result.prompt,/AI CREATIVE REFINEMENTS/);
  assert.match(result.prompt,/one cohesive result/i);
  assert.match(result.prompt,/Preserve existing backend/);
  assert.ok(result.review.passed);
});
test('Unsafe code-bearing creative output cannot enter copyable design specifications',async()=>{
  const insight='Minimal SaaS is a great structure for assignments, with accessible cards. Glass UI adds subtle depth. Creative UI enriches the palette. '+('Avoid hidden navigation and keep course progress visible. ').repeat(7)+'\n'+'import React from "react";';
  const response=await createDesignPrompt({project,mode:'generate',styles:['minimal'],
    env:{OPENROUTER_API_KEY:'test'},request:async()=>({ok:true,json:async()=>({choices:[{message:{content:insight}}]})})
  });
  assert.equal(response.source,'guide');
  assert.ok(response.review.reason.includes('insight-contains-code'));
  assert.doesNotMatch(response.prompt,/import React from/);
});
