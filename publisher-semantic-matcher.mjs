import {trustedPublisherLink} from './simple-discovery-chat.mjs';

// Only first-party publisher results enter this ranking engine. No URLs are
// constructed here, even when the semantic model proposes an unknown item.
const compact=v=>String(v??'').replace(/[\u0000-\u001f\u007f|<>]/g,' ').replace(/\s+/g,' ').trim();
const STOP=new Set(['the','and','for','with','from','that','this','your','their','application',
  'website','create','build','design','users','user','original','source','links','components','interactive']);
const tokens=v=>[...new Set((compact(v).toLowerCase().match(/[a-z0-9]{3,}/g)||[])
  .filter(w=>!STOP.has(w)))];
export function verifiedComponentCatalog(react=[],aceternity=[]){
  const unique=new Map();
  for(const item of [...react,...aceternity]){
    if(!item||!['React Bits','Aceternity UI'].includes(item.provider)||
       item.originalPrompt!==null||!trustedPublisherLink(item))continue;
    if(!unique.has(item.site))unique.set(item.site,{...item});
  }
  return [...unique.values()].slice(0,450);
}
export function sourceCatalogForModel(items){
  // Source names and metadata are untrusted. Strip markup and keep metadata
  // short; candidate indices, not any model-generated links, are returned.
  return items.slice(0,350).map((item,i)=>
    i+'|'+compact(item.provider).slice(0,16)+'|'+compact(item.name).slice(0,65)+
    '|'+compact(item.summary||item.description||'').slice(0,100)
  ).join('\n').slice(0,38000);
}
export function parseSemanticSelections(text,items,{limit=5}={}){
  if(typeof text!=='string'||text.length>7000)return null;
  const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  if(!raw.startsWith('{')||!raw.endsWith('}'))return null;
  try{
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.indices)||parsed.indices.length>8)return null;
    const selected=[],used=new Set();
    for(const index of parsed.indices){
      if(!Number.isInteger(index)||index<0||index>=items.length||used.has(index))continue;
      const item=items[index];
      if(!trustedPublisherLink(item))continue;
      used.add(index);selected.push(item);
      if(selected.length>=limit)break;
    }
    return selected;
  }catch{return null;}
}

// Generic offline fallback: these are reusable UI affordances, never lists of
// tested app prompts or domains. Semantic AI selection remains the main path.
const affordances=[
  {need:/\b(enter|input|search|location|city|address|choose|select|filter|customiz|personaliz|preferences?|form|query|type|upload)\w*\b/i,
    titles:/^(input|curved input|gooey input|placeholders and vanish input|prompt bar)$/i},
  {need:/\b(impact|count|measur|statistic|metric|score|reduc|improv|track|insight|saving|progress|quantity|numerical|performance)\w*\b/i,
    titles:/^(count up|counter)$/i},
  {need:/\b(routine|daily|schedule|plan|timeline|stages|history|steps|milestones|events|journey|sequence)\b/i,
    titles:/^(timeline|animated list)$/i},
  {need:/\b(suggest|recommend|alternatives?|choices|cards?|tips|tasks|options|catalog|products|solutions|hacks|items|projects)\b/i,
    titles:/^(bento grid|animated list|card hover effect|layout grid)$/i},
  {need:/\b(explain|assistant|response|guide|answer|teach|insight|text|reading|article|description|instructions|feedback)\b/i,
    titles:/^(text generate effect|text type|blur text)$/i},
  {need:/\b(sidebar|navigation|menu|sections|pages|tabs|collaps)\w*\b/i,
    titles:/^(sidebar|floating navbar|card nav)$/i},
  {need:/\b(alert|notifications?|warning|notices|updates|status|monitor)\w*\b/i,
    titles:/^(animated list|stateful button)$/i},
  {need:/\b(map|geograph|countries|world|globes|latitude|longitude)\w*\b/i,
    titles:/^(world map|globe|3d globe)$/i}
];
export function fallbackPublisherComponents(brief,items,{limit=5}={}){
  const q=String(brief||'').slice(0,2000);
  const chosen=[],used=new Set();
  for(const role of affordances){
    if(!role.need.test(q))continue;
    const matches=items.filter(item=>!used.has(item.site)&&role.titles.test(item.name));
    if(!matches.length)continue;
    const best=matches.sort((a,b)=>{
      const x=Math.min(16,Number(a.relevanceScore)||0);
      const y=Math.min(16,Number(b.relevanceScore)||0);
      return y-x||a.name.localeCompare(b.name);
    })[0];
    chosen.push(best);used.add(best.site);
    if(chosen.length>=limit)return chosen;
  }
  // Exact lexical evidence is safer than inventing a generic visual effect.
  const query=new Set(tokens(q));
  const lexical=items.filter(item=>!used.has(item.site)).map(item=>{
    const title=tokens(item.name);
    const description=tokens(item.summary||item.description||'');
    const overlaps=title.filter(w=>query.has(w)).length*3+
      description.filter(w=>query.has(w)).length;
    return {item,overlaps};
  }).filter(({overlaps})=>overlaps>=3).sort((a,b)=>b.overlaps-a.overlaps);
  for(const {item} of lexical){
    chosen.push(item);used.add(item.site);
    if(chosen.length>=limit)break;
  }
  return chosen;
}
export async function matchPublishedComponents(brief,react,aceternity,{
  model=null,limit=5}={}){
  const items=verifiedComponentCatalog(react,aceternity);
  if(!items.length)return {matches:[],status:'no-publisher-components'};
  const capacity=Math.max(1,Math.min(6,Number(limit)||5));
  if(typeof model==='function'){
    try{
      const answer=await model({
        brief:String(brief||'').slice(0,2400),
        sourceCatalog:sourceCatalogForModel(items)
      });
      const ranked=parseSemanticSelections(typeof answer==='string'?answer:answer?.text,items,{limit:capacity});
      if(ranked!==null)return {matches:ranked,status:ranked.length?'semantic-ranked':'no-relevant-matches'};
    }catch{/* Model outages must not create imaginary publisher results. */}
  }
  const matches=fallbackPublisherComponents(brief,items,{limit:capacity});
  return {matches,status:matches.length?'publisher-affordance-fallback':'semantic-unavailable'};
}
