/* Evidence-linked design intelligence. Pure, deterministic, and privacy-preserving. */
const clean=(v,max=2500)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
const unique=a=>[...new Set(a.filter(Boolean))];
const categories=[
['Healthcare',/\b(health|hospital|patient|medical|clinic|doctor)\b/i],
['Education',/\b(student|school|college|education|learning|tutor|teacher|courses?|study)\b/i],
['Commerce',/\b(store|shopping|marketplace|ecommerce|checkout|cart)\b/i],
['Finance',/\b(finance|fintech|bank|payment|budget|invest)\b/i],
['Portfolio',/\b(portfolio|resume|case studies|personal website)\b/i],
['AI Product',/\b(ai|llm|chatbot|agent|machine learning|generative)\b/i],
['SaaS',/\b(saas|dashboard|analytics|crm|enterprise)\b/i]
];
export const inferProjectCategory=brief=>categories.find(([,re])=>re.test(clean(brief)))?.[0]||'Digital product';
const roles=[
['Students / learners',/\b(students?|learners?)\b/i],
['Teachers / educators',/\b(teachers?|instructors?|professors?)\b/i],
['Parents / guardians',/\b(parents?|guardians?)\b/i],
['Patients',/\b(patients?)\b/i],
['Care providers',/\b(doctors?|caregivers?|clinicians?)\b/i],
['Administrators',/\b(admins?|administrators?)\b/i],
['Customers',/\b(customers?|shoppers?|buyers?)\b/i],
['Team members',/\b(teams?|employees?|staff)\b/i],
['Creators / designers',/\b(creators?|designers?|developers?)\b/i]
];
const featureRules=[
['assignments','Assignments and task tracking','Assignments and tasks','create, track and complete a task',/\b(assignments?|homework|tasks?|kanban)\b/i],
['tutor','AI tutor and assistance','AI assistance','ask and review an AI answer',/\b(ai tutor|tutoring|chatbot|ai assistant|virtual tutor)\b/i],
['calendar','Calendar and scheduling','Calendar and schedule','schedule and review an event',/\b(calendars?|schedules?|appointments?|bookings?)\b/i],
['progress','Progress and insights','Progress and insights','review progress and identify next actions',/\b(progress|analytics|reports?|insights?|grades?|metrics?)\b/i],
['courses','Courses and content','Courses and content','find and resume learning material',/\b(courses?|lessons?|curriculum|modules?)\b/i],
['messages','Messages and conversations','Messages','send and return to a conversation',/\b(messages?|chats?|conversations?|inbox)\b/i],
['commerce','Product discovery and checkout','Browse and checkout','compare products and complete checkout',/\b(products?|catalog|cart|checkout|shopping)\b/i],
['payments','Payments and transactions','Payments','review and complete a transaction',/\b(payments?|transactions?|invoices?|billing)\b/i],
['portfolio','Work and case studies','Work and case studies','inspect a case study and contact its creator',/\b(portfolio|case studies|project gallery)\b/i],
['settings','Settings and preferences','Settings','adjust preferences',/\b(settings?|preferences?|themes?|profiles?)\b/i],
['search','Search and filtering','Search and results','find and filter content',/\b(search|filters?|discover)\b/i]
];
const constraints=[
['Mobile responsive experience',/\b(mobile.first|responsive|mobile friendly|small screens?|smartphones?)\b/i],
['Accessible navigation, labels and contrast',/\b(accessib(?:le|ility)|wcag|screen.reader|keyboard.navigation|contrast)\b/i],
['Performance on low-power devices',/\b(low.end|slow device|performance|fast loading|lightweight|low power)\b/i],
['Reduced-motion alternatives',/\b(reduced.motion|no animations?|minimal motion)\b/i],
['Accessible dark appearance',/\b(dark mode|dark theme)\b/i],
['Accessible light appearance',/\b(light mode|light theme)\b/i],
['Offline behavior needs a synchronization plan',/\b(offline|without internet)\b/i],
['Private data and access control',/\b(privacy|security|confidential|sensitive)\b/i],
['Preserve existing backend and approved APIs',/\b(existing backend|preserve backend|keep backend|do not change backend)\b/i],
['Keep transparency readable',/\b(glassmorphism|glass ui|blurred panels)\b/i]
];
const pagesByCategory={
Healthcare:['Overview and appointments','Patient records','Care team','Settings'],
Education:['Learning overview','Courses and assignments','Progress and insights','Teacher workspace'],
Commerce:['Discover products','Product details','Checkout','Orders and account'],
Portfolio:['Introduction','Work and case studies','About','Contact'],
Finance:['Account overview','Transactions','Budgets and insights','Settings'],
'AI Product':['AI workspace','Conversations and results','Projects and history','Settings'],
SaaS:['Overview dashboard','Primary workflow','Reports and analytics','Team settings'],
'Digital product':['Overview and onboarding','Primary user workflow','Saved items and history','Settings']
};
export function analyzeProject(brief,{category}={}){
  const text=clean(brief);
  const kind=pagesByCategory[category]?category:inferProjectCategory(text);
  const audience=roles.filter(([,re])=>re.test(text)).map(([label])=>label);
  const features=featureRules.filter(x=>x[4].test(text)).map(([id,label,page,action])=>({id,label,page,action,evidence:'Explicitly mentioned'}));
  const limits=constraints.filter(([,re])=>re.test(text)).map(([label])=>label);
  const defaults=pagesByCategory[kind];
  const pages=unique([defaults[0],...features.map(x=>x.page),...defaults.slice(1)]).slice(0,10);
  const workflows=features.slice(0,5).map(f=>({name:f.label,steps:['Open '+f.page,'Find the relevant action','Use the interface to '+f.action,'Confirm success or recover from error']}));
  if(!workflows.length)workflows.push({name:'Primary task (suggested)',steps:['Open overview','Find primary action','Complete the action','Review confirmation']});
  const questions=[];
  if(!audience.length)questions.push('Who is the primary user?');
  if(!features.length)questions.push('What is the single most important task?');
  if(!limits.length)questions.push('Any device, accessibility, or performance constraints?');
  const decisions=unique((text.match(/(?:^|[.!?]\s+)([^.!?]{0,15}\b(?:must|keep|preserve|only|do not|without|should)\b[^.!?]{4,160})/gi)||[]).map(x=>clean(x,175))).slice(0,6);
  const requestedStyles=unique([/\b(glassmorphism|glass ui|glass panels|neon|futuristic|immersive|3d)\b/i.test(text)?'glass':null,/\b(minimal|clean|simple|apple.style)\b/i.test(text)?'minimal':null,/\b(creative|playful|editorial|bold)\b/i.test(text)?'creative':null]);
  return {category:kind,audience:audience.length?audience:['Primary audience not stated — confirm'],
    audienceSource:audience.length?'explicit':'suggested',features,constraints:limits,pages,workflows,
    goals:features.length?features.slice(0,3).map(f=>'Help users '+f.action):['Make the primary task discoverable (to confirm)'],
    explicitDecisions:decisions,requestedStyles,openQuestions:questions,evidenceLevel:features.length&&audience.length?'brief-specific':'partly-inferred',
    note:'Suggested pages and heuristic assessments are not findings from user testing or scanned websites.'};
}
const tradeoffs={
minimal:{strength:'Predictable task flows, strong hierarchy, good information density',risk:'Restrained visual treatment may require stronger brand differentiation',criteria:{usability:5,accessibility:5,performance:5,identity:3}},
glass:{strength:'Depth and atmosphere for immersive or exploratory experiences',risk:'Blur and transparency can reduce contrast and tax low-power devices',criteria:{usability:3,accessibility:3,performance:2,identity:5}},
creative:{strength:'Expressive identity and memorable editorial storytelling',risk:'Unusual layouts can slow repeat tasks and confuse navigation',criteria:{usability:3,accessibility:3,performance:3,identity:5}}
};
export function compareDirections(analysis,styles,preferences={}){
  const a=analysis||{};
  const key=a.category||'Digital product';
  const task=['Education','Finance','Healthcare','SaaS'].includes(key);
  const weights=preferences?.styleWeights||{};
  const performance=(a.constraints||[]).some(x=>x.includes('Performance')||x.includes('Reduced-motion'));
  const accessibility=(a.constraints||[]).some(x=>x.includes('Accessible'));
  const repeated=(a.features||[]).some(x=>['assignments','payments','progress'].includes(x.id));
  return (Array.isArray(styles)?styles:[]).map((s,i)=>{
    const t=tradeoffs[s.id]||tradeoffs.minimal;
    const prior=Math.max(-5,Math.min(5,Number(weights[s.id])||0));
    const base=task?(s.id==='minimal'?17:7):(s.id==='creative'?17:s.id==='glass'?14:12);
    const score=Math.max(48,Math.min(96,65+base+(repeated&&s.id==='minimal'?5:0)+(accessibility&&s.id==='minimal'?4:0)-(performance&&s.id==='glass'?12:0)-(repeated&&s.id==='creative'?4:0)+((a.requestedStyles||[]).includes(s.id)?18:0)+prior*2));
    return {id:s.id,name:s.name,match:score,criteria:{...t.criteria,projectFit:Math.max(2,Math.min(5,Math.round(score/20)))},
      strengths:t.strength,tradeoff:t.risk,reasons:[
        'For '+key.toLowerCase()+' requirements: '+t.strength+'.',
        ...(repeated?['Repeated tasks need stable navigation and clear feedback.']:[]),
        ...(accessibility?['Validate keyboard order, contrast and assistive-technology labels.']:[]),
        ...(performance&&s.id==='glass'?['Avoid heavy blurs on low-power devices.']:[]),
        ...(prior!==0?['Your private saved style feedback informed this indicator.']:[])
      ],scoring:'Heuristic fit indicator, not a measured usability score',order:i};
  }).sort((x,y)=>y.match-x.match||x.order-y.order).map(({order,...x})=>x);
}
export function planFusion(analysis,styles,preferences={}){
 const ranked=compareDirections(analysis,styles,preferences);
 const lead=ranked[0];
 return {anchor:lead?.name||'Minimal SaaS',supporting:ranked.slice(1).map(x=>x.name),
 rationale:lead?'Use '+lead.name+' as the structural anchor based on the brief, constraints and saved personal preferences.':'Choose one consistent structural foundation.',
 avoid:ranked.map(x=>x.tradeoff),criteria:'Prefer clear tasks, accessibility, performance and cohesive identity over mixing effects.'};
}
const FEATURE_ALIASES={
 assignments:['assignment','homework','task board','kanban'],
 tutor:['ai tutor','ai assistant','tutor','study assistant'],
 calendar:['calendar','scheduling','schedule'],
 progress:['progress','analytics','insights','metrics'],
 courses:['course','lesson','curriculum'],
 messages:['messages','conversation','inbox'],
 commerce:['product','shopping','checkout'],
 payments:['payment','transaction','invoice'],
 portfolio:['portfolio','case study','case studies'],
 settings:['settings','preferences'],
 search:['search','filter']
};
const CONSTRAINT_ALIASES=[
 ['backend',['backend','existing api','approved api']],
 ['low-power',['performance','low-power','low power','lightweight','loading']],
 ['Reduced-motion',['reduced-motion','reduced motion','prefers-reduced-motion']],
 ['Mobile responsive',['mobile','responsive','small screen']],
 ['Accessible navigation',['accessibility','keyboard','contrast']],
 ['offline',['offline','synchronization']],
 ['Private data',['privacy','security','access control']],
 ['dark appearance',['dark mode','dark theme']],
 ['light appearance',['light mode','light theme']]
];
export function qualityReview(text,{mode='generate',requiredStyles=[],requiredFeatures=[],requiredConstraints=[]}={}){
 const raw=String(text||'').trim().toLowerCase();
 const contains=terms=>terms.some(word=>raw.includes(word.toLowerCase()));
 const checks={length:raw.length>=800,audience:contains(['audience','personas','target users']),
  architecture:contains(['information architecture','sitemap','page plan','page map']),
  responsive:contains(['mobile','responsive']),accessibility:contains(['accessibility','keyboard','contrast']),
  components:contains(['component','button','navigation']),acceptance:contains(['checklist','acceptance','validation']),
  modes:mode==='fusion'?contains(['fusion','combine','blend']):requiredStyles.every(x=>raw.includes(x.toLowerCase())),
  promptOnly:!/(?:^|\n)\s*(?:import\s+react|<!doctype html>|<html|function\s+app\s*\(|export default function)/i.test(raw)};
 const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([id])=>id);
 for(const id of requiredFeatures){
   const terms=FEATURE_ALIASES[id]||[id];
   if(!contains(terms))missing.push('feature:'+id);
 }
 for(const constraint of requiredConstraints){
   const rule=CONSTRAINT_ALIASES.find(([keyword])=>constraint.toLowerCase().includes(keyword.toLowerCase()));
   if(rule&&!contains(rule[1]))missing.push('constraint:'+rule[0]);
 }
 return {passed:missing.length===0,checks,missing,evaluation:'Prompt coverage checks for sections, explicit modules and constraints; not real-world usability testing'};
}
