import {STYLES,inferCategory} from './design-engine.mjs';
import {designAiReply} from './ai-providers.mjs';

/** Prompt-only deliverables. Never produce executable UI or copy a reference site. */
const safe=(v,max=800)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
const defaultPages={
  Healthcare:['Overview and appointments','Patient experience and records','Care team workspace','Notifications and settings'],
  Education:['Learning overview','Courses and assignments','Progress and analytics','Teacher/admin workspace'],
  Commerce:['Discover and browse','Product details and comparison','Cart and checkout','Orders and account'],
  Portfolio:['Landing and introduction','Selected work and case studies','About and skills','Contact'],
  Finance:['Account overview','Transactions and filters','Budgets and insights','Settings and security'],
  'AI Product':['AI task workspace','Conversation and generated results','Projects and history','Settings and usage'],
  SaaS:['Overview dashboard','Core task workflow','Analytics and reports','Team and settings'],
  'Digital product':['Landing and onboarding','Primary user workflow','Saved items and history','Profile and settings'],
};
const getStyles=ids=>{
  const selected=[...new Set(ids||[])].filter(id=>STYLES.some(s=>s.id===id));
  return (selected.length?selected:STYLES.map(s=>s.id)).map(id=>STYLES.find(s=>s.id===id));
};
const referenceNames=items=>(items||[]).slice(0,8).map(r=>({
  name:safe(r.name,85),site:typeof r.site==='string'&&/^https:\/\//.test(r.site)?r.site:'',
  category:safe(r.category,80),tags:(r.tags||[]).slice(0,6).map(t=>safe(t,30)),
}));
export function buildDesignBrief({project,mode='generate',styles=[],references=[],preferences={},refinement=''}) {
  const selected=getStyles(styles);
  const category=project.recommendations?.category||inferCategory(project.brief);
  const pages=defaultPages[category]||defaultPages['Digital product'];
  const namedRefs=referenceNames(references);
  const prefers=selected.map(s=>s.name+': '+Number(preferences?.styleWeights?.[s.id]||0)).join(', ');
  const goals=[
    'Product: '+safe(project.brief,2500),
    'Product category: '+category,
    'Workflow: '+mode,
    'Explicitly selected styles: '+selected.map(s=>s.name).join(', '),
    'Prior personal preferences (private to this visitor): '+prefers,
    'Requested refinement: '+(safe(refinement,600)||'none'),
    'Suggested user journeys: '+pages.join(' | '),
    'Saved references (curated metadata ONLY, not analyzed screenshots): '+
      (namedRefs.length?namedRefs.map(r=>r.name+' ('+r.category+'; '+r.tags.join(', ')+')').join('; '):'none'),
    'Create an ORIGINAL design. Never claim to have scanned those websites.',
  ].join('\n');
  return {category,pages,selected,namedRefs,goals,refinement:safe(refinement,600)};
}

export function deterministicDesignPrompt(input){
  const b=buildDesignBrief(input);
  const fusion=input.mode==='fusion';
  const colors=b.selected.map(s=>'  '+s.name+' | '+s.colors.join(' / ')+' | Fonts: '+s.fonts).join('\n');
  const directions=b.selected.map((s,i)=>[
    'DIRECTION '+(i+1)+': '+s.name,
    '  Identity: '+s.description,
    '  Navigation/layout: '+s.layout,
    '  Palette: '+s.colors.join(', '),
    '  Typography: '+s.fonts,
    '  Animation: '+s.motion,
    '  UI patterns: '+s.short+'; preserve contrast, logical information architecture and reusable components.',
  ].join('\n')).join('\n\n');
  const refs=b.namedRefs.map(r=>' - '+r.name+' ('+r.site+'): use only these indexed category/tags ['+r.category+'; '+r.tags.join(', ')+']. Do not reproduce their interface.').join('\n');
  return [
    'FRONTLINE UX/UI — '+(fusion?'DESIGN FUSION SPECIFICATION':'ORIGINAL UI/UX GENERATION SPECIFICATION'),
    '',
    'ROLE & GOAL',
    'Act as a senior product designer. Design an original, intuitive, visually refined '+b.category.toLowerCase()+
      ' experience from this brief: '+safe(input.project.brief,2500),
    'Audience: Define the primary users, the key job each user must complete and success indicators. Make requirements testable.',
    b.refinement?'Revision request: '+b.refinement:'',
    '',
    'INFORMATION ARCHITECTURE & PAGE PLAN',
    ...b.pages.map((p,i)=>(i+1)+'. '+p+': describe content hierarchy, one core task, actions, empty/loading/error states and mobile behavior.'),
    'Define onboarding, navigation, search and return-user flow where appropriate. Include realistic sample content, not lorem ipsum.',
    '',
    fusion?'FUSION STRATEGY & TRADEOFFS':'THREE ORIGINAL DESIGN DIRECTIONS',
    fusion?
      'Use '+b.selected[0].name+' as the structural anchor. Borrow only complementary typography, depth, color or motion patterns from the remaining chosen directions. State what to omit to prevent visual clutter. Produce one cohesive result, never a collage.':
      'Compare three distinct original concepts (Minimal SaaS, Glass UI and Creative UI); recommend the best fit based on user goals, accessibility and usability. Explain the strengths and tradeoffs of each.',
    '',
    directions,
    '',
    'DESIGN SYSTEM',
    colors,
    'Specify a 4/8-point spacing scale, desktop and mobile type ramp, surface/elevation tokens, consistent icon set, border radii, content max-width, component states and accessible color contrast.',
    '',
    'CORE INTERACTIONS AND RESPONSIVENESS',
    'Provide desktop, tablet and mobile layouts; progressive disclosure, primary/secondary buttons, navigation, forms, focus/keyboard states, error recovery, touch targets and loading skeletons.',
    'Use purposeful motion with reduced-motion support; target usable response time and avoid heavy effects on low-power devices.',
    '',
    'REFERENCE INSPIRATION (NOT A LIVE VISUAL AUDIT)',
    refs||'No reference websites selected. Create from the original brief rather than copying an existing interface.',
    '',
    'ACCESSIBILITY & QUALITY CHECKLIST',
    '- WCAG-aware text contrast, semantic landmarks, keyboard order and screen-reader labels.',
    '- Clear information hierarchy and consistent component behavior on all screen sizes.',
    '- Complete user journeys with success, empty, loading and failure states.',
    '- Original product identity and no pixel-copy of referenced websites.',
    '- The output is a DESIGN PROMPT ONLY. Do not implement source code or claim a working app is generated.',
    '',
    'DELIVERABLE: A detailed, ready-to-copy UI/UX design specification with page maps, concrete component descriptions and an original art direction.',
  ].filter(Boolean).join('\n');
}
export async function createDesignPrompt({project,mode='generate',styles=[],references=[],preferences={},refinement='',env=process.env,request=fetch}){
  if(!['generate','fusion'].includes(mode))throw new Error('Invalid design mode');
  const b=buildDesignBrief({project,mode,styles,references,preferences,refinement});
  const fallback=deterministicDesignPrompt({project,mode,styles,references,preferences,refinement});
  const instruction=mode==='generate'?
    'Generate exactly THREE original design directions with clear tradeoffs, then a recommended detailed copyable specification.':
    'FUSE the selected styles and saved metadata-only inspirations into ONE original, coherent UI/UX prompt. Explain design priorities and conflicts.';
  const ai=await designAiReply({
    brief:project.brief,
    messages:[{role:'user',content:instruction+'\n\n'+b.goals+'\n\nFollow these requirements in detail:\n'+fallback.slice(0,6500)}],
    styles:b.selected,task:'prompt',env,request,
  });
  // Empty/truncated AI results must never degrade a dependable copyable prompt.
  if(ai?.text?.length>=500)return {prompt:ai.text,source:'ai',provider:ai.provider,mode};
  return {prompt:fallback,source:'guide',provider:null,mode};
}
