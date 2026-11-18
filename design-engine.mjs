import {analyzeProject,compareDirections,inferProjectCategory,planFusion,buildDecisionReport} from './project-intelligence.mjs';
// Original, explainable recommendation baseline; independent of any LLM provider.
export const STYLES = [
  { id:'minimal', name:'Minimal SaaS', short:'Precise, calm, and useful', icon:'layers', tag:'Best for clarity', accent:'#4859da', soft:'#eef0ff', colors:['#F8FAFC','#FFFFFF','#4859DA','#151B38'], fonts:'Inter / DM Sans', layout:'Structured two-column workspace', motion:'Subtle hover states and purposeful reveals', tags:['saas','dashboard','productivity','education','finance','professional','enterprise','healthcare'], description:'Clear hierarchy, generous whitespace, beautifully restrained UI.' },
  { id:'glass', name:'Glass UI', short:'Immersive and futuristic', icon:'sparkles', tag:'Best for innovation', accent:'#895cf6', soft:'#f2edff', colors:['#0D1124','#201C43','#895CF6','#58DFD5'], fonts:'Space Grotesk / Inter', layout:'Layered cards with an ambient hero', motion:'Soft parallax, depth and fluid transitions', tags:['ai','technology','futuristic','gaming','creative','portfolio','3d','security'], description:'Depth and atmosphere balanced with readable, accessible controls.' },
  { id:'creative', name:'Creative UI', short:'Bold, expressive, memorable', icon:'shapes', tag:'Best for personality', accent:'#f16c52', soft:'#fff0df', colors:['#FFF8EB','#FFCAAC','#F16C52','#2A2351'], fonts:'Outfit / Plus Jakarta Sans', layout:'Editorial asymmetric cards and playful sections', motion:'Characterful entrances and tactile micro-interactions', tags:['portfolio','agency','ecommerce','fashion','student','learning','community','art','brand'], description:'A distinctive visual identity with expressive typography and color.' }
];

// Verified current all-time category leaderboard positions 1–12; extra sites are not represented as ranked.
export const REFERENCES = [
  {id:'casa',name:'Casa di Solare',rank:1,score:9.30,site:'https://casadisolare.com',award:'https://www.webdesignawards.io/nominees/casa-di-solare',category:'Immersive commerce',styles:['glass','creative'],tags:['3d','ecommerce','storytelling','motion']},
  {id:'verda',name:'VerdaCert',rank:2,score:8.70,site:'https://www.verdacert.com',award:'https://www.webdesignawards.io/nominees/verdacert',category:'Service / SaaS',styles:['minimal'],tags:['service','saas','trust','content']},
  {id:'nexus',name:'NEXUSMAG',rank:3,score:8.50,site:'https://www.nexusmag.eu',award:'https://www.webdesignawards.io/nominees/nexusmag',category:'Editorial media',styles:['creative'],tags:['editorial','media','typography']},
  {id:'techy',name:'TECHYSCOUTS',rank:4,score:8.40,site:'https://www.techyscouts.com',award:'https://www.webdesignawards.io/nominees/techyscouts',category:'Digital agency',styles:['creative','glass'],tags:['agency','studio','interactive']},
  {id:'alien',name:'ALIEN Design',rank:5,score:8.30,site:'https://www.thealien.design',award:'https://www.webdesignawards.io/nominees/alien-design',category:'Creative studio',styles:['glass','creative'],tags:['studio','branding','motion']},
  {id:'nikola',name:'Nikola Radeski',rank:6,score:8.30,site:'https://nikolaradeski.com',award:'https://www.webdesignawards.io/nominees/nikolaradeski',category:'Portfolio',styles:['creative','glass'],tags:['portfolio','developer','creative']},
  {id:'outsiders',name:'Outsiders Agency',rank:7,score:8.30,site:'https://outsiders-agency.com',award:'https://www.webdesignawards.io/nominees/outsiders-agency-7',category:'Agency',styles:['creative'],tags:['agency','branding','studio']},
  {id:'blnk',name:'BLNK',rank:8,score:8.20,site:'https://www.blancavillalobos.com',award:'https://www.webdesignawards.io/nominees/blnk',category:'Portfolio',styles:['creative','minimal'],tags:['portfolio','editorial']},
  {id:'grass',name:'Grassfeld',rank:9,score:8.20,site:'https://www.grassfeld.com',award:'https://www.webdesignawards.io/nominees/grassfeld-the-best-financial-management-app',category:'Finance product',styles:['minimal'],tags:['finance','dashboard','product','saas']},
  {id:'supa',name:'Supa Stellar',rank:10,score:8.00,site:'https://www.supastellar.co',award:'https://www.webdesignawards.io/nominees/supa-stellar',category:'Creative agency',styles:['glass','creative'],tags:['agency','motion','creative']},
  {id:'workflow',name:'workflow',rank:11,score:8.00,site:'https://workflow.design',award:'https://www.webdesignawards.io/nominees/workflow',category:'Design studio',styles:['minimal','creative'],tags:['product','design','agency']},
  {id:'pixel',name:'Pixelmatters',rank:12,score:8.00,site:'https://www.pixelmatters.com',award:'https://www.webdesignawards.io/nominees/pixelmatters',category:'Product design',styles:['minimal'],tags:['product','saas','professional','agency']},
  {id:'jolt',name:'Jolt Digital',rank:null,score:null,site:'https://jolt.digital',award:null,category:'Additional inspiration',styles:['creative'],tags:['agency','marketing']},
  {id:'rectura',name:'Rectura',rank:null,score:null,site:'https://www.rectura.com',award:null,category:'Additional inspiration',styles:['minimal','creative'],tags:['design','agency']},
  {id:'bejamas',name:'Bejamas',rank:null,score:null,site:'https://bejamas.com',award:null,category:'Additional inspiration',styles:['minimal'],tags:['agency','development']}
];

const clean = text => String(text ?? '').trim().replace(/\s+/g,' ').slice(0,2500);
const keywords = txt => new Set(txt.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2));
export const inferCategory=inferProjectCategory;
export function recommend(brief,preferences={},library=REFERENCES,options={}){
  const prompt=clean(brief);
  const refinement=typeof options.refinement==='string'?clean(options.refinement).slice(0,450):'';
  const combined=refinement?prompt+'\nLatest refinement: '+refinement:prompt;
  const words=keywords(combined);
  const analysis=analyzeProject(combined);
  const category=analysis.category;
  const comparison=compareDirections(analysis,STYLES,preferences);
  const designs=comparison.map(c=>{
    const style=STYLES.find(s=>s.id===c.id);
    const refs=(Array.isArray(library)?library:[]).filter(ref=>Array.isArray(ref.styles)&&ref.styles.includes(style.id))
      .sort((a,b)=>b.tags.filter(tag=>words.has(tag)).length-a.tags.filter(tag=>words.has(tag)).length || (b.score||0)-(a.score||0))
      .slice(0,3).map(ref=>({id:ref.id,name:ref.name,award:ref.award,site:ref.site,rank:ref.rank}));
    return {...style,match:c.match,reasons:c.reasons,tradeoff:c.tradeoff,
      strengths:c.strengths,criteria:c.criteria,scoring:c.scoring,
      scoreFactors:c.scoreFactors,evidence:c.evidence,mitigations:c.mitigations,
      comparisonSummary:c.comparisonSummary,personalization:c.personalization,references:refs};
  });
  return {category,brief:prompt,refinement,designs,analysis,comparison,
    decision:buildDecisionReport(analysis,comparison),
    mode:'curated',
    recommendation:'For this '+category.toLowerCase()+' brief, '+designs[0].name+
      ' provides the strongest explainable fit. Compare the trade-offs before making your final selection.',
    suggestions:analysis.openQuestions.length?analysis.openQuestions:
      ['Which workflow should we prioritize?','What should the mobile layout do first?'],
    scoring:'Heuristic fit indicators, not measured usability, accessibility audits, or user-testing results'};
}
export function exportPrompt(project,selectedIds){
  const choices=project.recommendations?.designs||[];
  const chosen=choices.filter(d=>selectedIds.includes(d.id));
  const refinement=String(project.recommendations?.refinement||'').slice(0,450);
  const analysis=analyzeProject(project.brief+(refinement?'\nLatest refinement: '+refinement:''),{
    category:project.recommendations?.category});
  const fusion=planFusion(analysis,chosen);
  return [
    'FRONTLINE UX/UI — ORIGINAL SELECTED DESIGN SPECIFICATION',
    '',
    'PROJECT BRIEF',
    project.brief,
    '',
    'AUDIENCE & USER GOALS',
    'Users: '+analysis.audience.join(', ')+' ('+analysis.audienceSource+').',
    'Key goals: '+analysis.goals.join('; '),
    'Unknowns: '+(analysis.openQuestions.join('; ')||'Validate the inferred page choices with users.'),
    'LATEST APPROVED REFINEMENT: '+(refinement||'None.'),
    'EXPLICITLY OUT OF SCOPE — DO NOT ADD:',
    ...(analysis.excludedFeatures?.length?analysis.excludedFeatures.map(f=>'- '+f.label):
      ['No explicit exclusions provided. Do not invent extra requirements.']),
    '',
    'INFORMATION ARCHITECTURE AND WORKFLOWS',
    ...analysis.pages.map((p,i)=>(i+1)+'. '+p+': describe a primary user task, navigation, content hierarchy, loading/empty/error states and mobile behavior.'),
    ...analysis.workflows.map(f=>f.name+' workflow: '+f.steps.join(' → ')),
    '',
    'SELECTED DESIGN DIRECTIONS & TRADEOFFS',
    ...chosen.map(c=>'- '+c.name+': '+c.description+' Layout: '+c.layout+'. Type: '+c.fonts+'. Motion: '+c.motion+'. Palette: '+c.colors.join(', ')+'.'+
      (c.tradeoff?' Tradeoff: '+c.tradeoff+'.':'')),
    'If combining styles, use '+fusion.anchor+' as the structural anchor and only borrow complementary traits from other choices.',
    '',
    'APPROVED REQUIREMENTS & CONSTRAINTS',
    ...(analysis.constraints.length?analysis.constraints:['Clarify any special constraints before implementation.']),
    ...(analysis.explicitDecisions.length?analysis.explicitDecisions:['No explicit preservation decisions identified.']),
    '',
    'RESPONSIVE COMPONENTS, ACCESSIBILITY AND QUALITY',
    'Specify design tokens, typography scale, 4/8 spacing system, navigation, buttons, inputs, cards, feedback and error recovery.',
    'Explain desktop/tablet/mobile adaptations, accessible contrast, keyboard and focus states, screen-reader labels and reduced-motion alternatives.',
    'Include a detailed acceptance checklist tied to the named user goals and modules.',
    'Deliver one original copyable UI/UX PROMPT only, not executable code.',
    'Combine these directions into a cohesive experience rather than copying any reference website.',
  ].join('\n');
}
