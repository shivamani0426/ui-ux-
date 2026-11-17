import {STYLES,inferCategory} from './design-engine.mjs';
import {analyzeProject,compareDirections,planFusion,qualityReview} from './project-intelligence.mjs';
import {designAiReply} from './ai-providers.mjs';
import {preferenceHints} from './learning-engine.mjs';
import {buildRequirementTrace,formatRequirementTrace,formatRoleNavigation,
  formatPageInteractionContracts,reviewRequirementTrace} from './design-traceability.mjs';

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
  const personalHints=preferenceHints(preferences);
  const trace=buildRequirementTrace(analysis);
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
    'Optional private preferences (explicit project rules win): '+(personalHints.join(' | ')||'none or paused'),
    'Candidate pages (not yet validated): '+pages.join(' | '),
    'Required style comparison: '+comparisons.map(c=>c.name+' '+c.match+'/100 heuristic; '+c.tradeoff).join('; '),
    'Fusion structural anchor: '+fusion.anchor+'; strengths from: '+fusion.supporting.join(', '),
    'Saved inspiration metadata ONLY (not scanned screenshots): '+
      (namedRefs.length?namedRefs.map(r=>r.name+' ('+r.category+'; '+r.tags.join(', ')+')').join('; '):'none'),
    'Unknowns: '+(analysis.openQuestions.join('; ')||'none critical in supplied brief'),
    'Do not invent confirmed decisions, claim real usability scores, or clone any referenced interface.',
  ].join('\n');
  return {category,pages,selected,namedRefs,analysis,comparisons,fusion,goals,refinement:revision,personalHints,trace};
}

export function deterministicDesignPrompt(input){
  const b=buildDesignBrief(input);
  const isFusion=input.mode==='fusion';
  const brief=safe(input.project.brief,2500);
  const title=isFusion?'DESIGN FUSION SPECIFICATION':'ORIGINAL UI/UX GENERATION SPECIFICATION';
  const directions=b.selected.map((style,index)=>{
    const match=b.comparisons.find(c=>c.id===style.id);
    return [
      (isFusion?'FUSION INGREDIENT ':'DIRECTION ')+(index+1)+': '+style.name,
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
    'OPTIONAL PERSONAL DESIGN PREFERENCES',
    ...(b.personalHints.length?b.personalHints:['No stored personal preferences are active.']),
    'These are editable personal preferences, not confirmed requirements; an explicit new instruction always takes priority.',
    '',
    block('AUDIENCE, USER JOURNEYS & JOBS-TO-BE-DONE',
      b.analysis.workflows.map(w=>w.name+': '+w.steps.join(' → '))),
    '',
    block('FEATURES & COMPONENT RESPONSIBILITIES',featureLines),
    '',
    formatRequirementTrace(b.trace),
    '',
    'INFORMATION ARCHITECTURE & PAGE PLAN',
    ...b.pages.map((page,i)=>(i+1)+'. '+page+': specify primary user task, content hierarchy, navigation, buttons, reusable components, success/empty/loading/error states and mobile adaptation.'),
    'Show where users start, where they return, and how they recover from mistakes. Use realistic example content rather than placeholders.',
    '',
    formatRoleNavigation(b.analysis),
    '',
    formatPageInteractionContracts(b.analysis),
    '',
    isFusion?'FUSION STRATEGY, STYLE PRIORITIES & TRADEOFFS':'THREE ORIGINAL DESIGN DIRECTIONS & TRADEOFFS',
    isFusion?
      'Produce ONE cohesive result from the selected directions, not three disjoint sections. '+b.fusion.rationale+' Complement with '+(b.fusion.supporting.join(', ')||'no other style')+'. Avoid visual clutter, conflicting color tokens, and heavy motion.':
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
    'Define original tokens for surface, elevated surface, text, muted text, primary action, destructive action, focus, border and feedback states; include dark and light variants only where requested.',
    'Design-token handoff: map tokens to component variants and indicate what to check for contrast rather than asserting the colors already passed an audit.',
    'Navigation contract: define route labels, selected location, mobile overflow behavior and a consistent back/return path. Avoid inventing routes outside the proposed page map.',
    'Form contract: field labels, required/optional status, keyboard order, inline validation, disabled behavior and error recovery; do not claim backend validation exists.',
    '',
    'BEHAVIOR, ACCESSIBILITY & PERFORMANCE',
    'Accessibility: WCAG-aware text contrast, logical keyboard navigation, semantic landmarks, labels, focus restoration, accessible error messaging.',
    'Interaction states: loading, empty, success, retry and permission-denied; use clear ARIA live regions when needed.',
    'Performance: keep assets lightweight, progressive loading, meaningful skeletons, and respect prefers-reduced-motion.',
    'Never prescribe focus traps for a nonmodal UI; modal dialogs should manage focus and restore it when closed.',
    'Interaction micro-specification: for each requested module state the user trigger, visible response, in-progress state, error recovery and confirmation, including keyboard access.',
    'Responsive contract: specify a named mobile navigation solution, tablet adaptation, desktop hierarchy and touch-safe interaction targets; avoid unlabeled icon-only actions.',
    'Motion contract: describe purposeful transitions, readable timing, interruptibility, pause/skip where relevant, reduced-motion equivalence and what should never animate.',
    'Verification plan: run manual keyboard and contrast checks with actual chosen colors and real browser/device testing; these tests are still REQUIRED, not already completed.',
    '',
    'REFERENCE INSPIRATION — NOT A LIVE VISUAL AUDIT',
    references||'No saved inspirations; no external websites or screenshots have been inspected.',
    'Use only metadata-level themes as inspiration, not copied visuals, layouts, identities or proprietary assets.',
    '',
    block('UNRESOLVED QUESTIONS (ASK BEFORE FINAL IMPLEMENTATION)',
      b.analysis.openQuestions.length?b.analysis.openQuestions:['Validate the primary user task and sample content with the product owner.']),
    '',
    'QUALITY & ACCEPTANCE CHECKLIST',
    '- Verify every user-supplied module, explicitly mentioned user role and approved constraint has its own requirement trace with a proposed page and acceptance criterion.',
    '- Each page must state hierarchy, primary action, desktop/tablet/mobile behavior, permissions and failure recovery.',
    '- Check that proposed features and permissions are not represented as implemented, tested, connected or previously approved.',
    '- Explain style tradeoffs and why the chosen direction fits this actual brief.',
    '- Accessibility includes keyboard, color contrast, reduced-motion and error recovery.',
    '- Keep copy and visual treatments original; no invented evidence of user testing or a live screenshot analysis.',
    '- DESIGN PROMPT ONLY: Do not output React, HTML, CSS, JSON, or a claimed deployed working application.',
    '',
    'DELIVERABLE',
    'Return the complete, coherent, ready-to-copy UI/UX implementation prompt, with a useful page map, reusable components and measurable acceptance criteria.',
  ].filter(Boolean).join('\n');
}
/**
 * A long-form request can exhaust a free-model budget. Guarantee the complete
 * specification from evidence, with AI contributing a concise creative layer.
 */
export function inspectCreativeInsight(text,brief){
  const raw=String(text||'').trim();
  if(raw.length<180||raw.length>4500)return {accepted:false,reason:'insight-length'};
  if(/\u0060{3}|<\s*(?:script|html|style|iframe)\b|(?:^|\n)\s*(?:import\s+React|export default|function\s+App\s*\()/i.test(raw))
    return {accepted:false,reason:'insight-contains-code'};
  if(/\b(?:i (?:visited|inspected|scanned|audited) (?:the |your )?(?:live )?(?:website|screenshots?|site))\b/i.test(raw))
    return {accepted:false,reason:'insight-unverified-site-claim'};
  const lower=raw.toLowerCase(),mode=brief.mode;
  if(mode==='generate'&&!brief.selected.every(style=>lower.includes(style.name.toLowerCase())))
    return {accepted:false,reason:'insight-missing-style'};
  if(mode==='fusion'&&!lower.includes(brief.fusion.anchor.toLowerCase()))
    return {accepted:false,reason:'insight-missing-anchor'};
  if(brief.analysis.features.length){
    const featureReview=qualityReview(raw,{requiredFeatures:brief.analysis.features.map(f=>f.id)});
    const mentioned=brief.analysis.features.some(f=>!featureReview.missing.includes('feature:'+f.id));
    if(!mentioned)return {accepted:false,reason:'insight-not-project-specific'};
  }
  return {accepted:true,reason:null};
}
export async function createDesignPrompt({project,mode='generate',styles=[],references=[],preferences={},refinement='',env=process.env,request=fetch}){
  if(!['generate','fusion'].includes(mode))throw new Error('Invalid design mode');
  const input={project,mode,styles,references,preferences,refinement};
  const b=buildDesignBrief(input);
  const complete=deterministicDesignPrompt(input);
  // Keep the creative request brief. The verified full specification is already
  // available locally and does not depend on the AI provider being responsive.
  const instruction=mode==='generate'
    ?'Offer concise original creative enhancements under exactly these headings: Minimal SaaS, Glass UI, Creative UI. Give concrete layout and interface content with a real tradeoff for each.'
    :'Offer ONE coherent original fusion refinement. Name '+b.fusion.anchor+' as structural anchor; borrow from '+b.fusion.supporting.join(', ')+'. Give one concrete project module and one tradeoff.';
  const context=[
    instruction,
    'Brief: '+safe(project.brief,1300),
    'Audience: '+b.analysis.audience.join(', '),
    'Requested modules: '+(b.analysis.features.map(f=>f.label).join('; ')||'not confirmed'),
    'Constraints to respect: '+(b.analysis.constraints.join('; ')||'responsive and accessible defaults'),
    'Refinement: '+(b.refinement||'none'),
    'Private style preferences: '+(b.personalHints.join('; ')||'none'),
    'Style directions: '+b.selected.map(style=>style.name).join(', '),
    'If a fact is not present, label it as a suggestion. No source code or copied reference-site layout.'
  ].join('\n').slice(0,3300);
  let failure=null;
  const ai=await designAiReply({
    brief:project.brief,messages:[{role:'user',content:context}],
    styles:b.selected,task:'insight',env,request,designPreferences:b.personalHints,
    onFailure:info=>{failure=info}
  });
  const checked=inspectCreativeInsight(ai?.text,{...b,mode});
  const reviewOptions={mode,requiredStyles:b.selected.map(style=>style.name),
    requiredFeatures:b.analysis.features.map(feature=>feature.id),
    requiredConstraints:b.analysis.constraints};
  const originalReview=qualityReview(complete,reviewOptions);
  const originalTrace=reviewRequirementTrace(complete,b.trace);
  if(checked.accepted){
    const marker='\nQUALITY & ACCEPTANCE CHECKLIST\n';
    const enriched=complete.replace(marker,
      '\nAI CREATIVE REFINEMENTS — OPTIONAL ORIGINAL IDEAS\n'+ai.text.trim()+
      '\n\nThese refinements are suggestions only. If they conflict with stated requirements, the confirmed constraints and page plan above take precedence.\n'+marker);
    const reviewed=qualityReview(enriched,reviewOptions);
    const reviewedTrace=reviewRequirementTrace(enriched,b.trace);
    if(reviewed.passed&&reviewedTrace.passed){
      return {prompt:enriched,source:'ai',provider:ai.provider,mode,composition:'structured-plus-ai',
        review:{...reviewed,traceability:reviewedTrace,usedFallback:false,aiEnhanced:true}};
    }
  }
  return {prompt:complete,source:'guide',provider:null,mode,composition:'structured',
    review:{...originalReview,traceability:originalTrace,usedFallback:true,aiAttempted:!!ai,
      reason:ai?[checked.reason||'enhanced-spec-incomplete']:[failure?.reason||'ai-insight-unavailable'],
      retryAfterSeconds:failure?.retryAfterSeconds||0}};
}
