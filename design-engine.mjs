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
export function inferCategory(text){
  const s=text.toLowerCase();
  if(/health|clinic|hospital|patient|medical|wellness/.test(s))return 'Healthcare';
  if(/student|school|college|course|learning|education|teacher/.test(s))return 'Education';
  if(/store|shop|fashion|marketplace|ecommerce|product catalog/.test(s))return 'Commerce';
  if(/portfolio|personal website|resume/.test(s))return 'Portfolio';
  if(/finance|bank|payment|budget|invest/.test(s))return 'Finance';
  if(/ai|agent|model|machine learning|chatbot/.test(s))return 'AI Product';
  if(/dashboard|analytics|saas|business|crm/.test(s))return 'SaaS';
  return 'Digital product';
}
export function recommend(brief, preferences={}, library=REFERENCES){
  const prompt=clean(brief);
  const words=keywords(prompt);
  const category=inferCategory(prompt);
  const specialStyle= /dark|neon|glass|futuristic|3d/.test(prompt.toLowerCase())?'glass':/playful|fun|bright|colorful|bold|creative/.test(prompt.toLowerCase())?'creative':/clean|minimal|simple|professional|enterprise/.test(prompt.toLowerCase())?'minimal':null;
  const weights=preferences.styleWeights||{};
  const designs=STYLES.map(style=>{
    const matched=style.tags.filter(tag=>words.has(tag)||prompt.toLowerCase().includes(tag));
    const score=Math.min(98,69+Math.min(16,matched.length*5)+(style.id===specialStyle?10:0)+Math.min(7,(weights[style.id]||0)*2));
    const refs=library.filter(r=>r.styles.includes(style.id)).sort((a,b)=>{
      const ka=a.tags.filter(t=>words.has(t)).length;const kb=b.tags.filter(t=>words.has(t)).length;
      return kb-ka || (b.score||0)-(a.score||0);
    }).slice(0,3).map(r=>({id:r.id,name:r.name,award:r.award,site:r.site,rank:r.rank}));
    return {...style,match:score,reasons:[`${category} projects benefit from ${style.layout.toLowerCase()}.`,matched.length?`Matched your brief on ${matched.slice(0,3).join(', ')}.`:'A complementary direction worth comparing.',`Motion: ${style.motion.toLowerCase()}.`],references:refs};
  }).sort((a,b)=>b.match-a.match);
  return {category,brief:prompt,designs,mode:'curated',recommendation:`For a ${category.toLowerCase()} project, start with ${designs[0].name} for the clearest fit, then explore both alternatives. You can select all three to compare or combine their strengths.`,suggestions:['Who is your primary audience?','Which pages are essential?','Would you prefer a light, dark, or adaptive theme?']};
}
export function exportPrompt(project,selectedIds){
  const chosen=project.recommendations.designs.filter(d=>selectedIds.includes(d.id));
  return `Build an original, responsive ${project.recommendations.category} website.\n\nProject brief: ${project.brief}\n\nSelected design direction(s): ${chosen.map(c=>c.name).join(', ')}.\n\nDesign principles:\n${chosen.map(c=>`- ${c.name}: ${c.description} Layout: ${c.layout}. Type: ${c.fonts}. Motion: ${c.motion}. Palette: ${c.colors.join(', ')}.`).join('\n')}\n\nCombine these directions into a cohesive, accessible design rather than copying any reference website. Include a landing page, intuitive navigation, task-specific dashboards where relevant, responsive mobile layouts, thoughtful empty/error/loading states, accessible focus styles, and reduced-motion support. Provide a page map and reusable component specification. Use React, TypeScript and Tailwind CSS; keep dependencies reasonable.\n`;
}