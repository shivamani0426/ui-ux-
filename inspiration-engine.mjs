import {analyzeProject} from './project-intelligence.mjs';

/**
 * Inspiration Intelligence v2: auditable metadata retrieval. Signals describe
 * a curated index; there is NO live website inspection, screenshot recognition
 * or empirically measured UX quality. The brief takes precedence over taste.
 */
const GROUPS=[
  ['ai','artificial','intelligence','machine','ml','agent','chatbot','automation','technology','tech'],
  ['education','student','school','college','university','course','courses','learning','learn','tutor','teacher','lms','study'],
  ['health','healthcare','medical','doctor','clinic','hospital','patient','wellness','care'],
  ['finance','fintech','bank','banking','payment','payments','budget','investment','financial'],
  ['commerce','ecommerce','shop','shopping','store','marketplace','checkout','product','retail'],
  ['creative','portfolio','personal','artist','photography','editorial','magazine','branding','agency'],
  ['saas','dashboard','analytics','enterprise','business','crm','productivity','service'],
  ['motion','interactive','animation','animated','3d','immersive','cinematic','parallax'],
  ['minimal','minimalist','simple','clean','professional','white','restrained'],
  ['dark','glass','glassmorphism','neon'],
  ['accessibility','accessible','keyboard','contrast','wcag','inclusive'],
  ['mobile','responsive','phone','tablet','small','touch']
];
const syn=new Map(GROUPS.flatMap(group=>group.map(word=>[word,group[0]])));
const STOP=new Set(['the','for','with','and','that','this','want','create','make','design','website','web','app','application','page','pages','need','into','from','have','user','users','a','an','ui','ux','build','please','like','new','using','to','my','our','should']);
const terms=v=>String(v||'').toLowerCase().match(/[a-z0-9]+/g)||[];
const normalize=v=>terms(v).filter(w=>!STOP.has(w)).map(w=>syn.get(w)||w);
const unique=v=>[...new Set(v)];
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,35):[];
const cleanArray=list; // Preserve the established Select prompt contract.
const overlap=(left,right)=>unique(left.flatMap(normalize)).filter(w=>right.has(w));
const numeric=(value,low,high)=>Number.isFinite(Number(value))?Math.max(low,Math.min(high,Number(value))):0;
const safeUrl=value=>{
  try{
    const url=new URL(value);
    return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password?url.href:null;
  }catch{return null;}
};

/**
 * Explicit exclusion phrases must never turn into positive recommendation
 * keywords. We handle typical short constraint clauses and the structured
 * analyzer's explicit excluded features, never arbitrary semantic guesses.
 */
export function inspirationBriefSignals(brief){
  const text=String(brief||'').slice(0,2500);
  const negative=[];
  const regex=/\b(?:without|no|exclude|excluding|avoid|do not include|don't include|must not include)\s+([a-z][a-z0-9 -]{1,55})(?=[,.;]|\b(?:but|while|instead|however)\b|$)/gi;
  let positive=text;
  positive=positive.replace(regex,(_whole,phrase)=>{
    negative.push(...normalize(phrase));
    return ' ';
  });
  const excluded=analyzeProject(text).excludedFeatures||[];
  for(const item of excluded){
    if(item?.id)negative.push(...normalize(item.id));
    if(item?.label)negative.push(...normalize(item.label));
  }
  const denied=new Set(negative);
  return {
    requested:new Set(normalize(positive).filter(word=>!denied.has(word))),
    excluded:denied
  };
}
function scoreSource(source,signals,{favoriteTags=[],styleWeights={}}={}){
  const tags=list(source.tags),styles=list(source.styles),category=String(source.category||'');
  const q=signals.requested,excluded=signals.excluded;
  const matchedTags=tags.filter(t=>overlap([t],q).length>0);
  const matchedCategory=overlap([category],q);
  const matchedName=overlap([source.name],q);
  const matchedSummary=overlap([source.summary],q);
  const excludedMatches=unique([...tags,category,source.name,source.summary]
    .flatMap(normalize).filter(t=>excluded.has(t)));
  const favorite=new Set(list(favoriteTags).flatMap(normalize));
  const favoriteMatches=unique(tags.flatMap(normalize).filter(t=>favorite.has(t)));
  const styleSignal=styles.reduce((n,id)=>n+Math.max(0,numeric(styleWeights?.[id],-5,5)),0);
  const direct=Math.min(80,
    Math.min(48,matchedTags.length*16)+Math.min(18,matchedCategory.length*9)+
    Math.min(10,matchedName.length*5)+Math.min(4,matchedSummary.length*2));
  const personal=Math.min(10,Math.min(6,favoriteMatches.length*3)+Math.min(4,styleSignal));
  const penalty=Math.min(45,excludedMatches.length*23);
  const fit=Math.max(0,Math.min(100,direct+personal-penalty));
  const reasons=[];
  if(matchedTags.length)reasons.push('Brief themes: '+matchedTags.slice(0,3).join(', '));
  if(matchedCategory.length)reasons.push('Category metadata aligns with your request');
  if(matchedName.length&&!matchedTags.length)reasons.push('Reference title matches your brief');
  if(excludedMatches.length)reasons.push('Caution: metadata overlaps an excluded feature ('+excludedMatches.slice(0,3).join(', ')+')');
  if(personal)reasons.push('Small adjustment from your private style selections');
  if(!reasons.length)reasons.push('Alternative direction; no direct metadata match found');
  return {score:fit,direct,personal,penalty,matchedTags,matchedCategory,
    excludedMatches,reasons,personalized:personal>0};
}
export function rankInspirations(brief,library,preferences={}){
  const signals=inspirationBriefSignals(brief);
  const seen=new Set();
  const ranked=(Array.isArray(library)?library:[]).filter(s=>{
    if(!s||s.active===false||typeof s.id!=='string'||!s.id||seen.has(s.id)||!safeUrl(s.site))return false;
    seen.add(s.id);return true;
  }).map(source=>{
    const evidence=scoreSource(source,signals,preferences);
    return {
      id:source.id,name:String(source.name||'').slice(0,120),site:safeUrl(source.site),
      award:safeUrl(source.award),category:String(source.category||'').slice(0,120),
      tags:list(source.tags),styles:list(source.styles),summary:String(source.summary||'').slice(0,700),
      rank:source.rank??null,score:source.score??null,
      matchScore:evidence.score,
      matchLabel:evidence.penalty?'Review constraint':evidence.score>=45?'Strong metadata fit':
        evidence.score>=16?'Related metadata':'Explore alternative',
      reasons:evidence.reasons,
      personalized:evidence.personalized,
      evidence:{
        direct:evidence.direct,personal:evidence.personal,excludedPenalty:evidence.penalty,
        matchingTags:evidence.matchedTags.slice(0,5),
        excludedOverlap:evidence.excludedMatches.slice(0,5)
      },
      provenance:'Curated reference metadata; not a live website scan'
    };
  });
  ranked.sort((a,b)=>b.matchScore-a.matchScore||
    b.evidence.direct-a.evidence.direct||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  // Light diversification only among near-tied items; never override a strong
  // requirement fit or move excluded-feature overlaps above clean matches.
  const output=[],remaining=ranked.slice();
  while(remaining.length&&output.length<30){
    const best=remaining[0],band=remaining.filter(item=>
      item.matchScore>=best.matchScore-4 &&
      Boolean(item.evidence.excludedPenalty)===Boolean(best.evidence.excludedPenalty));
    const counts=new Map();
    for(const item of output)counts.set(item.category,(counts.get(item.category)||0)+1);
    band.sort((a,b)=>{
      const pa=Math.min(3,counts.get(a.category)||0);
      const pb=Math.min(3,counts.get(b.category)||0);
      return (b.matchScore-pb)-(a.matchScore-pa)||
        b.evidence.direct-a.evidence.direct||a.name.localeCompare(b.name);
    });
    const chosen=band[0];
    output.push(chosen);
    remaining.splice(remaining.indexOf(chosen),1);
  }
  return output;
}

export function makeSelectionPrompt(project,sourceRows){
  const refs=(Array.isArray(sourceRows)?sourceRows:[]).slice(0,8);
  if(!refs.length)throw new Error('Select at least one inspiration before copying a prompt.');
  const refinement=typeof project.recommendations?.refinement==='string'
    ?project.recommendations.refinement.trim().slice(0,450):'';
  const brief=String(project.brief||'').slice(0,2500);
  const analysis=analyzeProject(brief+(refinement?'\nLatest refinement: '+refinement:''));
  const referenceLines=refs.map((r,i)=>{
    const tags=cleanArray(r.tags).slice(0,6).join(', ')||'thoughtful design';
    return `${i+1}. ${r.name} (${r.site}) — ${r.category}. Study these qualities: ${tags}.`;
  }).join('\n');
  return `Create an ORIGINAL and accessible UI/UX design specification for the project below.

PROJECT BRIEF
${brief}

LATEST APPROVED REFINEMENT
${refinement||'None.'}

EXPLICITLY OUT OF SCOPE — DO NOT ADD
${analysis.excludedFeatures?.map(feature=>feature.label).join('; ')||'No explicit exclusions given.'}

PROJECT UNDERSTANDING (CONFIRMED AND PROPOSED)
Audience: ${analysis.audience.join(', ')} (${analysis.audienceSource}).
Explicit modules: ${analysis.features.map(x=>x.label).join('; ')||'none confirmed'}.
User goals: ${analysis.goals.join('; ')}.
Constraints: ${analysis.constraints.join('; ')||'none specified'}.
Suggested pages: ${analysis.pages.join(' | ')}.
Preserve approved decisions: ${analysis.explicitDecisions.join('; ')||'none explicitly stated'}.
Unresolved questions: ${analysis.openQuestions.join(' | ')||'validate proposed layout with the product owner'}.

SELECTED INSPIRATIONS (for direction, NOT duplication)
${referenceLines}

DELIVERABLE
Write a detailed, structured UI/UX implementation prompt that includes:
1. Concept, audience, key user journeys, and primary conversion goal.
2. Sitemap and page-by-page content hierarchy.
3. Visual system: color palette with hex values, type scale, spacing and grid.
4. Reusable components, navigation patterns and responsive behavior.
5. Meaningful hover, loading, scroll and transition motion, with reduced-motion support.
6. Accessibility requirements (contrast, keyboard, focus states, semantic structure).
7. Design decisions explaining how the reference qualities are recombined into a cohesive ORIGINAL result.
8. Clear constraints and acceptance criteria for an AI design/build tool.

Do not copy layouts, logos, illustrations, source code, or protected assets from the reference websites. Use references as inspiration only. Return the detailed prompt, not a deployed website.`;
}
