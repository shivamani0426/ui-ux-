/**
 * Frontline Milestone 09: deterministic traceability and design handoff.
 *
 * A trace is a proposed DESIGN CONTRACT, not a claim that backend functionality,
 * accessibility, user testing or reference-site inspection has been verified.
 * Every explicitly recognized module, role, and constraint remains independently
 * addressable and can be checked before a prompt is shared.
 */
const unique=a=>[...new Set(a.filter(Boolean))];
const squash=(value,max=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const pickPage=(analysis,page)=>{
  const pages=Array.isArray(analysis?.pages)?analysis.pages:[];
  return pages.includes(page)?page:(pages[0]||'Overview (proposed)');
};
const roleDestination=(role,analysis)=>{
  const name=String(role).toLowerCase();
  const match=name.includes('administrator')?'Administration':
    name.includes('teacher')?'Teacher workspace':
    name.includes('student')?'Learning overview':
    name.includes('patient')?'Overview and appointments':
    name.includes('care')?'Care team':
    name.includes('customer')?'Discover products':
    name.includes('creator')?'Work and case studies':
    name.includes('team')?'Overview dashboard':
    (analysis?.pages||[])[0];
  return pickPage(analysis,match);
};
const constraintTest=(constraint)=>{
  const c=constraint.toLowerCase();
  if(c.includes('mobile')||c.includes('responsive'))
    return 'At phone, tablet and desktop widths, primary navigation, task actions and forms remain usable without horizontal overflow.';
  if(c.includes('accessib')||c.includes('contrast'))
    return 'Provide keyboard-only task completion, labeled controls, visible focus, and a documented manual contrast check; never claim an untested WCAG pass.';
  if(c.includes('performance')||c.includes('low-power'))
    return 'Define performance budgets and test a representative low-power device without blocking the primary task.';
  if(c.includes('reduced-motion'))
    return 'Respect prefers-reduced-motion, preserve meaning without movement and allow manual control of animation.';
  if(c.includes('offline'))
    return 'Specify offline empty/retry/sync states and conflict recovery; do not imply an offline backend already exists.';
  if(c.includes('private')||c.includes('security'))
    return 'Define authorization, consent, redaction and permission-denied states without inventing an existing security audit.';
  if(c.includes('backend')||c.includes('api'))
    return 'Preserve existing approved endpoints and data contracts; propose UI behavior without changing the backend.';
  if(c.includes('dark')||c.includes('light'))
    return 'Define contrast-tested tokens for the requested appearance and keyboard-visible focus in both themes.';
  if(c.includes('transparency'))
    return 'Provide an opaque fallback for translucent surfaces and check text contrast on actual backgrounds.';
  return 'Validate this stated constraint in desktop, mobile and error-state reviews.';
};
const safeId=value=>squash(value,90).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';

export function buildRequirementTrace(analysis={}){
  const pages=Array.isArray(analysis.pages)?analysis.pages:[];
  const features=(Array.isArray(analysis.features)?analysis.features:[]).map(f=>{
    const requested=squash(f.label,120);
    const page=pickPage(analysis,f.page);
    const routePresent=pages.includes(f.page);
    return {
      id:'F-'+safeId(f.id),type:'feature',label:requested,evidence:'explicit brief reference',
      page,routePresent,
      acceptance:'On '+page+', a user can '+squash(f.action,140)+
        '; test loading, empty, success, error and recovery states on desktop and mobile.',
      notes:routePresent?'Proposed page appears in the page map.':'Suggested destination; confirm page map before development.'
    };
  });
  const roleIsExplicit=analysis.audienceSource==='explicit';
  const roles=roleIsExplicit?(Array.isArray(analysis.audience)?analysis.audience:[]).map(role=>{
    const label=squash(role,110),page=roleDestination(label,analysis);
    return {
      id:'R-'+safeId(label),type:'role',label,evidence:'explicit audience mention',
      page,
      acceptance:'Provide a named entry point, task-specific navigation and a permission boundary for '+label+
        '; confirm actual permissions with the product owner before building.',
      notes:'The role is stated in the brief; its suggested page and permissions are not verified.'
    };
  }):[];
  const constraints=(Array.isArray(analysis.constraints)?analysis.constraints:[]).map((label,i)=>({
    id:'C-'+String(i+1).padStart(2,'0'),type:'constraint',label:squash(label,180),
    evidence:'brief-derived constraint',page:'All applicable pages',
    acceptance:constraintTest(String(label)),
    notes:'A requirement to verify, not a completed test result.'
  }));
  const decisions=(Array.isArray(analysis.explicitDecisions)?analysis.explicitDecisions:[]).map((label,i)=>({
    id:'D-'+String(i+1).padStart(2,'0'),type:'preserved-decision',
    label:squash(label,190),evidence:'quoted or normalized project instruction',
    page:'All affected flows',
    acceptance:'Show how this instruction remains true after the visual transformation and record any change for explicit approval.',
    notes:'Do not silently override this instruction with suggested style choices.'
  }));
  return {
    rows:[...features,...roles,...constraints,...decisions],
    count:{features:features.length,roles:roles.length,constraints:constraints.length,decisions:decisions.length},
    missingAudience:!roleIsExplicit,
    missingFeatures:features.length===0,
    evidence:'Proposed traceability from brief-derived requirements; no user-testing, accessibility or backend audit performed.',
  };
}
export function formatRequirementTrace(trace){
  const lines=['REQUIREMENT TRACEABILITY MATRIX',
    'The following items are DESIGN REQUIREMENTS mapped from the supplied brief. Page placements, states and tests are proposed, not implemented or certified.',
    ...trace.rows.map(row=>'['+row.id+'] '+row.type.toUpperCase()+' · '+row.label+
      '\n  Evidence: '+row.evidence+
      '\n  Proposed page/coverage: '+row.page+
      '\n  Acceptance criterion: '+row.acceptance+
      '\n  Uncertainty: '+row.notes),
    ...(trace.missingAudience?['[QUESTION-AUDIENCE] Confirm the primary user role; do not invent an approved persona.']:[]),
    ...(trace.missingFeatures?['[QUESTION-PRIMARY-TASK] Confirm the core action before treating the suggested page map as approved.']:[]),
    'No source-code implementation, live website inspection or conformance test is claimed.'];
  return lines.join('\n');
}
export function reviewRequirementTrace(text,trace){
  const raw=String(text||'');
  const start=raw.indexOf('\nREQUIREMENT TRACEABILITY MATRIX\n');
  const end=raw.indexOf('\nINFORMATION ARCHITECTURE & PAGE PLAN',start+1);
  const section=start>=0?raw.slice(start,end>=0?end:undefined):'';
  const missing=trace.rows.filter(row=>!section.includes('['+row.id+']')).map(row=>row.id);
  if(trace.missingAudience&&!section.includes('[QUESTION-AUDIENCE]'))missing.push('QUESTION-AUDIENCE');
  if(trace.missingFeatures&&!section.includes('[QUESTION-PRIMARY-TASK]'))missing.push('QUESTION-PRIMARY-TASK');
  return {
    passed:start>=0&&end>start&&missing.length===0,
    mapped:trace.rows.length-missing.filter(x=>trace.rows.some(r=>r.id===x)).length,
    total:trace.rows.length,
    count:trace.count,
    missing,
    warning:'Mapping validates generated-prompt completeness, not actual accessibility, quality, correctness or implementation.',
  };
}
export function formatRoleNavigation(analysis={}){
  if(analysis.audienceSource!=='explicit'||!(analysis.audience||[]).length){
    return [
      'ROLE-SPECIFIC NAVIGATION & PERMISSION STATES',
      'Primary audience is not confirmed. Label role navigation as a proposal and ask the owner before implementing access controls.',
    ].join('\n');
  }
  return ['ROLE-SPECIFIC NAVIGATION & PERMISSION STATES',
    ...unique(analysis.audience).map(role=>{
      const target=roleDestination(role,analysis);
      return '- '+role+': propose '+target+' as the starting destination. Define the role-specific primary action, which data is visible, a role-switch/recovery path if applicable, and a permission-denied state. These are suggested behaviors, NOT confirmed grants.';
    }),
    'Never expose a teacher, administrator, patient, customer or other user role’s data to another role without explicit authorization.',
  ].join('\n');
}
export function formatPageInteractionContracts(analysis={}){
  const pages=Array.isArray(analysis.pages)?analysis.pages:[];
  const features=Array.isArray(analysis.features)?analysis.features:[];
  const targets=pages.length?pages:['Overview (proposed)'];
  return [
    'PER-PAGE INTERACTION CONTRACTS',
    'For every page, describe entry route, users, primary task, state changes, keyboard handling, mobile layout and recovery. These are proposed UI contracts.',
    ...targets.map((page,i)=>{
      const related=features.filter(f=>f.page===page);
      const actions=related.length?related.map(f=>squash(f.action,140)).join('; '):'propose one action aligned to the original brief, subject to approval';
      return (i+1)+'. '+page+
        '\n  Users: assign only explicitly mentioned roles; verify page permissions before implementation.'+
        '\n  Main action(s): '+actions+'.'+
        '\n  Desktop: stable primary navigation, clear page heading, task location and consistent return path.'+
        '\n  Mobile: narrow-column content, visible primary action and an accessible labeled navigation destination.'+
        '\n  States: initial, loading, empty, validation error, permission denied, success confirmation, retry and restored focus.'+
        '\n  Cross-page handoff: make entry and return routes explicit; do not duplicate unrelated destinations.';
    })
  ].join('\n');
}
