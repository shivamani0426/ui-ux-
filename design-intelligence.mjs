import {STYLES,inferCategory} from './design-engine.mjs';
import {analyzeProject,compareDirections,planFusion,qualityReview} from './project-intelligence.mjs';
import {designAiReply} from './ai-providers.mjs';

/** Prompt-only output; no executable code, live screenshot inspection or private-data aggregation. */
const safe=(v,max=800)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
const getStyles=ids=>{
  const values=[...new Set(Array.isArray(ids)?ids:[])].filter(id=>STYLES.some(style=>style.id===id));
  return (values.length?values:STYLES.map(style=>style.id)).map(id=>STYLES.find(style=>style.id===id));
};
const referenceNames=items=>(Array.isArray(items)?items:[]).slice(0,8).map(r=>({
  name:safe(r?.name,85),site:typeof r?.site==='string'&&/^https:\/\//.test(r.site)?r.site:'',
  category:safe(r?.category,80),tags:(Array.isArray(r?.tags)?r.tags:[]).slice(0,6).map(t=>safe(t,30))
}));
const block=(heading,items)=>heading+'\n'+items.map(item=>'- '+item).join('\n');
export function buildDesignBrief({project,mode='generate',styles=[],references=[],preferences={},refinement=''}) {
  const selected=mode==='generate'?STYLES:getStyles(styles);
  const category=project.recommendations?.category||inferCategory(project.brief);
  const analysis=analyzeProject(project.brief,{category});
  const pages=analysis.pages;
  const namedRefs=referenceNames(references);
  const comparisons=compareDirections(analysis,selected,preferences);
  const fusion=planFusion(analysis,selected,preferences);
  const revision=safe(refinement,600);
  const goals=[
    'Project brief (untrusted user description): '+safe(project.brief,2500),
    'Product category: '+category,
    'Mode: '+mode+' (prompt only, not generated website)',
    'Audience: '+analysis.audience.join('; ')+' ('+analysis.audienceSource+')',
    'Explicit modules: '+(analysis.features.map(f=>f.label).join('; ')||'not established'),
    'Functional goals: '+analysis.goals.join('; '),
    'Constraints: '+(analysis.constraints.join('; ')||'none explicitly mentioned'),
    'Existing decisions to preserve: '+(analysis.explicitDecisions.join(' | ')||'none explicitly stated'),
    'Requested refinement: '+(revision||'none'),
    'Candidate pages (not yet validated): '+pages.join(' | '),
    'Required style comparison: '+comparisons.map(c=>c.name+' '+c.match+'/100 heuristic; '+c.tradeoff).join('; '),
    'Fusion structural anchor: '+fusion.anchor+'; strengths from: '+fusion.supporting.join(', '),
    'Saved inspiration metadata ONLY (not scanned screenshots): '+
      (namedRefs.length?namedRefs.map(r=>r.name+' ('+r.category+'; '+r.tags.join(', ')+')').join('; '):'none'),
    'Unknowns: '+(analysis.openQuestions.join('; ')||'none critical in supplied brief'),
    'Do not invent confirmed decisions, claim real usability scores, or clone any referenced interface.',
  ].join('\n');
  return {category,pages,selected,namedRefs,analysis,comparisons,fusion,goals,refinement:revision};
}

export function deterministicDesignPrompt(input){
  const b=buildDesignBrief(input);
  const isFusion=input.mode==='fusion';
  const brief=safe(input.project.brief,2500);
  const title=isFusion?'DESIGN FUSION SPECIFICATION':'ORIGINAL UI/UX GENERATION SPECIFICATION';
  const directions=b.selected.map((style,index)=>{
    const match=b.comparisons.find(c=>c.id===style.id);
    return [
      'DIRECTION '+(index+1)+': '+style.name,
      '  Intent: '+style.description,
      '  Structural layout: '+style.layout,
      '  Suggested palette: '+style.colors.join(', '),
      '  Typography: '+style.fonts,
      '  Motion: '+style.motion,
      '  Explainable fit: '+match.match+'/100, a heuristic indicator (NOT a measured usability score).',
      '  Strength: '+match.strengths,
      '  Tradeoff: '+match.tradeoff,
      '  Navigation: explain primary/secondary actions, active state, empty state and keyboard use.',
    ].join('\n');
  }).join('\n\n');
  const references=b.namedRefs.map(r=>r.name+' ('+r.site+'), metadata category '+r.category+', tags '+r.tags.join(', ')).join('\n');
  const featureLines=b.analysis.features.length?b.analysis.features.map(f=>
    f.label+': explain how a user can '+f.action+'; include empty, loading, success and failure states.'):
    ['Primary product task is UNKNOWN. Propose one tentative flow and clearly label it for confirmation.'];
  const comparisons=b.comparisons.map(c=>c.name+': fit indicator '+c.match+'/100; '+c.strengths+'; tradeoff: '+c.tradeoff+'.');
  return [
    'FRONTLINE UX/UI — '+title,
    '',
    'ROLE, PURPOSE & EVIDENCE',
    'Act as a senior product designer. Write ONE original, actionable UI/UX design specification, not executable code.',
    'Actual project brief: '+brief,
    'Product category: '+b.category,
    'Primary audience: '+b.analysis.audience.join(', ')+'. '+(b.analysis.audienceSource==='suggested'?'Audience is NOT CONFIRMED.':'Audience was stated in the brief.'),
    'User goals: '+b.analysis.goals.join('; '),
    'Assumptions must be clearly marked; do not silently invent user roles, data sources or integrations.',
    '',
    'CONFIRMED CONSTRAINTS & REFINEMENT',
    ...(b.analysis.constraints.length?b.analysis.constraints:['No technical constraints confirmed; propose accessible, responsive defaults.']),
    ...(b.analysis.explicitDecisions.length?['Preserve previously approved user decisions:'].concat(b.analysis.explicitDecisions):[]),
    b.refinement?'Latest refinement takes precedence on changed details: '+b.refinement:'No new refinement requested. Keep earlier approved decisions.',
    'Never discard approved functional requirements while altering visual style.',
    '',
    block('AUDIENCE, USER JOURNEYS & JOBS-TO-BE-DONE',
      b.analysis.workflows.map(w=>w.name+': '+w.steps.join(' → '))),
    '',
    block('FEATURES & COMPONENT RESPONSIBILITIES',featureLines),
    '',
    'INFORMATION ARCHITECTURE & PAGE PLAN',
    ...b.pages.map((page,i)=>(i+1)+'. '+page+': specify primary user task, content hierarchy, navigation, buttons, reusable components, success/empty/loading/error states and mobile adaptation.'),
    'Show where users start, where they return, and how they recover from mistakes. Use realistic example content rather than placeholders.',
    '',
    isFusion?'FUSION STRATEGY, STYLE PRIORITIES & TRADEOFFS':'THREE ORIGINAL DESIGN DIRECTIONS & TRADEOFFS',
    isFusion?
      'Produce ONE cohesive direction, not three disjoint sections. '+b.fusion.rationale+' Complement with '+(b.fusion.supporting.join(', ')||'no other style')+'. Avoid visual clutter, conflicting color tokens, and heavy motion.':
      'Compare the three alternative directions and recommend ONE as the strongest fit, explaining how project-specific usability and accessibility affect the choice.',
    '',
    directions,
    '',
    block('EXPLAINABLE COMPARISON (ESTIMATES, NOT TEST RESULTS)',comparisons),
    '',
    'DESIGN SYSTEM & RESPONSIVE COMPONENTS',
    'Define original color tokens in HEX, type scale, 4/8 point spacing, grid, content widths, surfaces, border radius and restrained elevation.',
    'Specify sidebar, bottom navigation or drawer as appropriate; reusable cards, tables, forms, buttons, dialogs and notifications only when the product needs them.',
    'Specify desktop, tablet and mobile rules with explicit layout changes, touch targets and focus-visible states.',
    '',
    'BEHAVIOR, ACCESSIBILITY & PERFORMANCE',
    'Accessibility: WCAG-aware text contrast, logical keyboard navigation, semantic landmarks, labels, focus restoration, accessible error messaging.',
    'Interaction states: loading, empty, success, retry and permission-denied; use clear ARIA live regions when needed.',
    'Performance: keep assets lightweight, progressive loading, meaningful skeletons, and respect prefers-reduced-motion.',
    'Never prescribe focus traps for a nonmodal UI; modal dialogs should manage focus and restore it when closed.',
    '',
    'REFERENCE INSPIRATION — NOT A LIVE VISUAL AUDIT',
    references||'No saved inspirations; no external websites or screenshots have been inspected.',
    'Use only metadata-level themes as inspiration, not copied visuals, layouts, identities or proprietary assets.',
    '',
    block('UNRESOLVED QUESTIONS (ASK BEFORE FINAL IMPLEMENTATION)',
      b.analysis.openQuestions.length?b.analysis.openQuestions:['Validate the primary user task and sample content with the product owner.']),
    '',
    'QUALITY & ACCEPTANCE CHECKLIST',
    '- Verify every user-supplied module and approved constraint appears in the specification.',
    '- Each page must state hierarchy, primary action, mobile behavior and failure recovery.',
    '- Explain style tradeoffs and why the chosen direction fits this actual brief.',
    '- Accessibility includes keyboard, color contrast, reduced-motion and error recovery.',
    '- Keep copy and visual treatments original; no invented evidence of user testing or a live screenshot analysis.',
    '- DESIGN PROMPT ONLY: Do not output React, HTML, CSS, JSON, or a claimed deployed working application.',
    '',
    'DELIVERABLE',
    'Return the complete, coherent, ready-to-copy UI/UX implementation prompt, with a useful page map, reusable components and measurable acceptance criteria.',
  ].filter(Boolean).join('\n');
}
export async function createDesignPrompt({project,mode='generate',styles=[],references=[],preferences={},refinement='',env=process.env,request=fetch}){
  if(!['generate','fusion'].includes(mode))throw new Error('Invalid design mode');
  const input={project,mode,styles,references,preferences,refinement};
  const b=buildDesignBrief(input);
  const fallback=deterministicDesignPrompt(input);
  const instruction=mode==='generate'?
    'Produce exactly THREE original style directions, compare usability/contrast/performance and recommend a tailored design specification.':
    'Produce ONE coherent fusion prompt, anchoring its structure in the best-fit selected style and acknowledging conflicts.';
  const ai=await designAiReply({
    brief:project.brief,
    messages:[{role:'user',content:instruction+'\n\nGround everything in this project understanding:\n'+b.goals+
      '\n\nFull required coverage:\n'+fallback.slice(0,12000)}],
    styles:b.selected,task:'prompt',env,request
  });
  const reviewed=ai?.text?qualityReview(ai.text,{mode,requiredStyles:b.selected.map(x=>x.name)}):null;
  if(reviewed?.passed)return {prompt:ai.text,source:'ai',provider:ai.provider,mode,
    review:{...reviewed,usedFallback:false}};
  const local=qualityReview(fallback,{mode,requiredStyles:b.selected.map(x=>x.name)});
  return {prompt:fallback,source:'guide',provider:null,mode,
    review:{...local,usedFallback:true,aiAttempted:!!ai,reason:reviewed?.missing||[]}};
}
