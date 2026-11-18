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
// A phrase like "without chat" must never become a recommended chat module.
// Interpret the last explicit mention, so a later refinement can deliberately
// replace an earlier requirement. No model calls or third-party data involved.
const NEGATION=/\b(?:no|without|exclude(?:d)?|omit|avoid|remove|never|do\s+not|does\s+not|must\s+not|should\s+not|don't|not\s+(?:include|use|need|require|allow))\b/gi;
const PRESERVATION=/\b(?:do\s+not|must\s+not|should\s+not|don't|never)\s+(?:remove|exclude|omit|drop|delete)\b/i;
const sentences=text=>String(text||'').split(/[.!?;\n]+|\b(?:but|however|instead)\b/gi).filter(Boolean);
const ruleStatus=(text,re)=>{
  let latest=null,position=0;
  for(const clause of sentences(text)){
    const matches=[...clause.matchAll(new RegExp(re.source,'gi'))];
    for(const m of matches){
      const before=clause.slice(Math.max(0,m.index-75),m.index);
      const negative=[...before.matchAll(NEGATION)].some(hit=>before.length-(hit.index+hit[0].length)<=66)
        &&!PRESERVATION.test(before);
      latest={excluded:negative,position:position+m.index,
        excerpt:clause.trim().replace(/\s+/g,' ').slice(0,145)};
    }
    position+=clause.length+1;
  }
  return latest;
};
export const inferProjectCategory=brief=>{
  const text=clean(brief);
  const choices=categories.map(([name,re],order)=>({
    name,order,status:ruleStatus(text,re),
    evidence:[...text.matchAll(new RegExp(re.source,'gi'))].length
  })).filter(c=>c.status&&!c.status.excluded)
    .sort((a,b)=>b.evidence-a.evidence||a.order-b.order);
  return choices[0]?.name||'Digital product';
};
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
['commerce','Product discovery and catalog','Product catalog','browse and compare products',/\b(products?|catalog|shopping|storefront|marketplace)\b/i],
['checkout','Cart and checkout','Checkout','review cart and complete checkout',/\b(cart|checkout|place (?:an )?order|purchase flow)\b/i],
['payments','Payments and transactions','Payments','review and complete a transaction',/\b(payments?|transactions?|invoices?|billing)\b/i],
['portfolio','Work and case studies','Work and case studies','inspect a case study and contact its creator',/\b(portfolio|case studies|project gallery)\b/i],
['notifications','Notification center','Notifications','review notifications and find unread items',/\b(notifications?|unread count|alerts?|reminders?)\b/i],
['profile','Student and user profiles','Profile','review and edit the user profile',/\b(student profiles?|user profiles?|account profiles?|profile pages?|student account)\b/i],
['settings','Settings and preferences','Settings','adjust preferences',/\b(settings?|preferences?|themes?)\b/i],
['search','Search and filtering','Search and results','find and filter content',/\b(search|filters?|discover)\b/i],
['attendance','Attendance records','Attendance','record and review attendance status',/\b(attendance|absences|present days)\b/i],
['assessments','Exams, quizzes and assessments','Assessments','find an assessment, submit a response and review its result',/\b(exams?|quizzes?|assessments?)\b/i],
['enrollment','Enrollment and admissions','Enrollment','enroll and review an enrollment decision',/\b(enrollment|enrolment|admissions?|enrollments?)\b/i],
['approvals','Review and approvals','Approvals','approve, reject or request a revision with a clear status',/\b(approvals?|moderation|review requests?)\b/i],
['submissions','File attachments and submissions','Submissions','submit and review an uploaded document',/\b(submissions?|file uploads?|attachments?)\b/i]
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
Education:['Learning overview','Courses and content','Progress and insights','Teacher workspace'],
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
  const audience=roles.filter(([,re])=>{
    const status=ruleStatus(text,re);return status&&!status.excluded;
  }).map(([label])=>label);
  const interpreted=featureRules.map(([id,label,page,action,re])=>({
    id,label,page,action,status:ruleStatus(text,re)
  })).filter(x=>x.status);
  const features=interpreted.filter(x=>!x.status.excluded)
    .sort((a,b)=>a.status.position-b.status.position)
    .map(({id,label,page,action})=>({id,label,page,action,evidence:'Explicitly mentioned'}));
  const excludedFeatures=interpreted.filter(x=>x.status.excluded).map(x=>({
    id:x.id,label:x.label,evidence:'Explicitly excluded',excerpt:x.status.excerpt
  }));
  const limits=constraints.filter(([,re])=>re.test(text)).map(([label])=>label);
  const defaults=pagesByCategory[kind].filter(page=>
    page!=='Teacher workspace'||audience.includes('Teachers / educators'));
  const rolePages=audience.includes('Administrators')?['Administration']: [];
  // Explicit modules come before proposed defaults. Related course/assignment
  // pages collapse to a single destination, not two overlapping navigation items.
  // Excluded capabilities cannot quietly return through generic category pages.
  const disallowed=excludedFeatures.flatMap(f=>({
    payments:[/transactions/i,/payments/i],
    checkout:[/checkout/i],
    commerce:[/discover products/i,/product details/i,/checkout/i,/orders and account/i],
    messages:[/conversations and results/i],
    tutor:[/ai assistance/i]
  }[f.id]||[]));
  const pages=unique([defaults[0],...features.map(x=>x.page),...rolePages,...defaults.slice(1)])
    .filter(page=>!disallowed.some(rule=>rule.test(page))).slice(0,15);
  const workflows=features.slice(0,9).map(f=>({name:f.label,steps:['Open '+f.page,'Find the relevant action','Use the interface to '+f.action,'Confirm success or recover from error']}));
  if(!workflows.length)workflows.push({name:'Primary task (suggested)',steps:['Open overview','Find primary action','Complete the action','Review confirmation']});
  const questions=[];
  if(!audience.length)questions.push('Who is the primary user?');
  if(!features.length)questions.push('What is the single most important task?');
  if(audience.length>1)questions.push('Which tasks and private data should each named role be allowed to access?');
  if(features.some(f=>f.id==='tutor'))questions.push('What sources, accuracy checks and escalation path should the AI tutor use when uncertain?');
  if(!limits.length)questions.push('Any device, accessibility, or performance constraints?');
  const decisions=unique((text.match(/(?:^|[.!?]\s+)([^.!?]{0,15}\b(?:must|keep|preserve|only|do not|without|should)\b[^.!?]{4,160})/gi)||[]).map(x=>clean(x,175))).slice(0,6);
  const requestedStyles=unique([
    ruleStatus(text,/\b(glassmorphism|glass ui|glass panels|neon|futuristic|immersive|3d)\b/i)?.excluded===false?'glass':null,
    ruleStatus(text,/\b(minimal|clean|simple|apple.style)\b/i)?.excluded===false?'minimal':null,
    ruleStatus(text,/\b(creative|playful|editorial|bold)\b/i)?.excluded===false?'creative':null
  ]);
  return {category:kind,audience:audience.length?audience:['Primary audience not stated — confirm'],
    audienceSource:audience.length?'explicit':'suggested',features,excludedFeatures,constraints:limits,pages,workflows,
    goals:features.length?features.slice(0,6).map(f=>'Help users '+f.action):['Make the primary task discoverable (to confirm)'],
    explicitDecisions:decisions,requestedStyles,openQuestions:questions,evidenceLevel:features.length&&audience.length?'brief-specific':'partly-inferred',
    confidence:features.length>=2&&audience.length?'high':features.length||audience.length?'medium':'low',
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
    const requested=(a.requestedStyles||[]).includes(s.id);
    const factors=[
      {label:'Neutral starting point',points:65,source:'heuristic'},
      {label:'Product type '+key,points:base,source:'inferred category'},
      {label:'Repeatable workflows',points:repeated?(s.id==='minimal'?5:s.id==='creative'?-4:0):0,
        source:'explicit modules'},
      {label:'Accessibility requirement',points:accessibility&&s.id==='minimal'?4:0,
        source:'brief constraint'},
      {label:'Performance and reduced motion',points:performance&&s.id==='glass'?-12:0,
        source:'brief constraint'},
      {label:'Explicit style preference',points:requested?18:0,source:'brief style direction'},
      {label:'Private learned preference',points:prior*2,source:'account-only feedback'}
    ].filter(f=>f.points!==0);
    const baseScore=factors.reduce((total,f)=>total+f.points,0)-prior*2;
    const bound=n=>Math.max(48,Math.min(96,n));
    const baseline=bound(baseScore),score=bound(baseScore+prior*2);
    const appliedPoints=score-baseline;
    const personalization={
      styleSignal:prior,
      expectedPointAdjustment:prior*2,
      appliedPointAdjustment:appliedPoints,
      scoreBounded:appliedPoints!==prior*2,
    };
    const applicableFeatures=(a.features||[]).slice(0,2).map(f=>f.label);
    const mitigations=s.id==='glass'
      ?['Use opaque controls and text layers; limit backdrop blur, especially on mobile.',
        'Provide a low-motion, low-power path without sacrificing the primary task.']
      :s.id==='creative'
        ?['Keep primary navigation and form actions predictable despite expressive visuals.',
          'Offer a restrained mode for frequent or accessibility-critical workflows.']
        :['Avoid making information dense by default; validate task hierarchy with actual users.',
          'Use distinctive but accessible brand accents without hiding important actions.'];
    return {id:s.id,name:s.name,match:score,personalization,
      scoreFactors:factors.map(f=>({...f,points:f.label==='Private learned preference'?appliedPoints:f.points})),
      evidence:{category:key,requestedModules:applicableFeatures,
        constraints:(a.constraints||[]).slice(0,4),confidence:a.confidence||'low'},
      mitigations,comparisonSummary:applicableFeatures.length
        ?s.name+' is assessed for '+applicableFeatures.join(' and ')+'; its score is a bounded heuristic, not a tested result.'
        :s.name+' is provisional until the primary workflow is confirmed.',
      criteria:{...t.criteria,projectFit:Math.max(2,Math.min(5,Math.round(score/20)))},
      strengths:t.strength,tradeoff:t.risk,reasons:[
        'For '+key.toLowerCase()+' requirements: '+t.strength+'.',
        ...(applicableFeatures.length?['Explicit work to support: '+applicableFeatures.join('; ')+'.']:[]),
        ...(repeated?['Repeated tasks need stable navigation and clear feedback.']:[]),
        ...(accessibility?['Validate keyboard order, contrast and assistive-technology labels.']:[]),
        ...(performance&&s.id==='glass'?['Avoid heavy blurs on low-power devices.']:[]),
        ...(prior!==0?['Your private feedback signal '+(prior>0?'+':'')+prior+
          '/5 changed this bounded heuristic indicator by '+(appliedPoints>0?'+':'')+
          appliedPoints+' points'+(personalization.scoreBounded?' (score limit reached).':'.')+
          ' New project requirements remain primary.']:[])
      ],scoring:'Heuristic fit indicator, not a measured usability score',order:i};
  }).sort((x,y)=>y.match-x.match||x.order-y.order).map(({order,...x})=>x);
}
/** Transparent, brief-grounded decision support (not a model's hidden thoughts).
 * No private data is shared with other users or external AI providers. */
export function buildDecisionReport(analysis={},comparisons=[]){
  const ranked=Array.isArray(comparisons)?comparisons:[];
  const primary=ranked[0]||null;
  const features=Array.isArray(analysis.features)?analysis.features:[];
  const excluded=Array.isArray(analysis.excludedFeatures)?analysis.excludedFeatures:[];
  const constraints=Array.isArray(analysis.constraints)?analysis.constraints:[];
  return {
    version:2,
    status:analysis.confidence||'low',
    primaryStyle:primary?{id:primary.id,name:primary.name,heuristicFit:primary.match,
      tradeoff:primary.tradeoff,mitigations:primary.mitigations||[]}:null,
    evidence:{
      category:analysis.category||'Digital product',
      audience:analysis.audienceSource==='explicit'?(analysis.audience||[]):[],
      requestedFeatures:features.map(f=>f.label),
      excludedCapabilities:excluded.map(f=>f.label),
      constraints:constraints.slice(0,12),
      unconfirmed:(analysis.openQuestions||[]).slice(0,6)
    },
    decisionRules:[
      'Explicit requirements and exclusions take precedence over saved preferences.',
      'Style fit uses disclosed heuristic factors, not live usability or accessibility measurements.',
      'Keep the strongest task structure; borrow visual details from secondary directions only when they do not conflict.',
      'Validate open questions and visual contrast with actual users before implementation.'
    ],
    alternatives:ranked.slice(1).map(item=>({
      id:item.id,name:item.name,heuristicFit:item.match,tradeoff:item.tradeoff,
      mitigations:item.mitigations||[]
    }))
  };
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
 commerce:['product','shopping','catalog'],
 checkout:['checkout','cart','purchase','place an order'],
 payments:['payment','transaction','invoice'],
 portfolio:['portfolio','case study','case studies'],
 profile:['profile','student account','user account'],
 notifications:['notification','alert','unread'],
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
