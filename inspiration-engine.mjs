/**
 * Frontline Select UI/UX: explainable, deterministic inspiration matching.
 * Uses curated Supabase metadata; no scraping and no invented screenshot/LLM claims.
 * Personalization uses only this visitor's prior saved selections.
 */
const GROUPS = [
  ['ai','artificial','intelligence','machine','ml','agent','chatbot','automation','futuristic','technology','tech'],
  ['education','student','school','college','university','course','courses','learning','learn','tutor','teacher','lms','study'],
  ['health','healthcare','medical','doctor','clinic','hospital','patient','wellness','care'],
  ['finance','fintech','bank','banking','payment','payments','budget','investment','financial'],
  ['commerce','ecommerce','shop','shopping','store','marketplace','checkout','product','retail'],
  ['creative','portfolio','personal','artist','photography','editorial','magazine','branding','agency'],
  ['saas','dashboard','analytics','enterprise','business','crm','productivity','service'],
  ['motion','interactive','animation','animated','3d','immersive','cinematic','parallax'],
  ['minimal','minimalist','simple','clean','professional','modern','white','restrained'],
  ['dark','glass','glassmorphism','neon','futuristic'],
];
const syn=new Map(GROUPS.flatMap(group=>group.map(word=>[word,group[0]])));
const STOP=new Set(['the','for','with','and','that','this','want','create','make','design','website','web','app','application','page','pages','need','into','from','have','user','users','a','an','ui','ux','build','please','like','new','using','to','my','our']);
const words=value=>String(value||'').toLowerCase().match(/[a-z0-9]+/g)||[];
const normalize=value=>words(value).filter(w=>!STOP.has(w)).map(w=>syn.get(w)||w);
const tokens=value=>new Set(normalize(value));
const cleanArray=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,35):[];
const scoreText=(terms,wordsSet)=>terms.filter(t=>wordsSet.has(t)).length;

export function rankInspirations(brief,library,{styleWeights={},favoriteTags=[]}={}){
  const q=tokens(brief);
  const favorites=new Map(cleanArray(favoriteTags).map(t=>[syn.get(t)||t,true]));
  return (Array.isArray(library)?library:[])
    .filter(s=>s&&s.active!==false&&typeof s.id==='string'&&typeof s.site==='string')
    .map(s=>{
      const tags=cleanArray(s.tags), styles=cleanArray(s.styles), category=String(s.category||'');
      const qTags=tags.filter(t=>normalize(t).some(w=>q.has(w)));
      const categoryMatch=normalize(category).filter(w=>q.has(w));
      const nameMatch=normalize(s.name).filter(w=>q.has(w));
      const descriptionMatch=normalize(s.summary).filter(w=>q.has(w));
      const tasteTags=tags.filter(t=>normalize(t).some(w=>favorites.has(w)));
      const tasteStyles=styles.reduce((n,id)=>n+Math.max(0,Number(styleWeights[id])||0),0);
      // Heuristic signals, not a statistically calibrated probability or model evaluation.
      const signal=Math.min(100,
        qTags.length*19 + Math.min(20,categoryMatch.length*12) + Math.min(16,nameMatch.length*8) +
        Math.min(9,descriptionMatch.length*3) + Math.min(12,tasteTags.length*4) +
        Math.min(8,tasteStyles*2)
      );
      const explanations=[];
      if(qTags.length) explanations.push('Related themes: '+qTags.slice(0,3).join(', '));
      if(categoryMatch.length) explanations.push('Fits the '+category+' category');
      if(tasteTags.length||tasteStyles>0) explanations.push('Reflects your earlier design selections');
      if(!explanations.length) explanations.push('A different visual direction to compare');
      return {
        id:s.id,name:String(s.name||''),site:s.site,award:s.award||null,category,
        tags,styles,summary:s.summary||'',rank:s.rank??null,score:s.score??null,
        matchScore:signal,matchLabel:signal>=45?'Strong signal':signal>=19?'Related inspiration':'Explore alternative',
        reasons:explanations,personalized:tasteTags.length>0||tasteStyles>0,
      };
    })
    .sort((a,b)=>b.matchScore-a.matchScore || (b.score??0)-(a.score??0) || a.name.localeCompare(b.name))
    .slice(0,30);
}

export function makeSelectionPrompt(project,sourceRows){
  const refs=(Array.isArray(sourceRows)?sourceRows:[]).slice(0,8);
  if(!refs.length)throw new Error('Select at least one inspiration before copying a prompt.');
  const referenceLines=refs.map((r,i)=>{
    const tags=cleanArray(r.tags).slice(0,6).join(', ')||'thoughtful design';
    return `${i+1}. ${r.name} (${r.site}) — ${r.category}. Study these qualities: ${tags}.`;
  }).join('\n');
  return `Create an ORIGINAL and accessible UI/UX design specification for the project below.

PROJECT BRIEF
${String(project.brief||'').slice(0,2500)}

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
