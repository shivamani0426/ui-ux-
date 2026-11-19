import crypto from 'node:crypto';
import {publisherComponentIntentBoost} from './publisher-component-intent.mjs';

// Original, first-party JSON registry published specifically for AI integrations.
// No page scraping, guessing slugs, cloning code, or invented prompts.
const ENDPOINT='https://ui.aceternity.com/api/components';
const MAX_RESPONSE_BYTES=380_000,TTL_MS=10*60*1000;
const STOP=new Set(('a an the and with for from create build make design website app application '+
  'ui ux interface user users please want need modern beautiful original react '+ 
  'our my your their this that have will should can of in at is on to as it').split(' '));
const cache={expires:0,items:[]};
let inFlight=null;
const clean=(v,max=240)=>typeof v==='string'?
  v.replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const singular=t=>({cards:'card',responses:'response',messages:'message',buttons:'button',menus:'menu',transitions:'transition'}[t]||t);
const words=v=>[...new Set((clean(v,3000).toLowerCase().match(/[a-z0-9]{3,30}/g)||[])
  .filter(w=>!STOP.has(w)).map(singular))];
export function validateAceternityComponentUrl(value,slug){
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;
  if(typeof value!=='string')return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.hostname!=='ui.aceternity.com'||
      url.port||url.username||url.password||url.search||url.hash||
      url.pathname!==('/components/'+slug))return null;
    return url.href;
  }catch{return null;}
}
export function parseAceternityOfficialCatalogue(doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||
    doc.meta?.website!=='https://ui.aceternity.com'||!Array.isArray(doc.components))
    throw Error('Aceternity publisher catalogue schema invalid');
  if(doc.components.length<20||doc.components.length>1500)
    throw Error('Aceternity source catalogue contains unexpected number of items');
  const accepted=new Map();
  for(const item of doc.components){
    if(!item||typeof item!=='object')continue;
    const site=validateAceternityComponentUrl(item.documentationUrl,item.name);
    const name=clean(item.title,95);
    if(!site||name.length<2||accepted.has(site))continue;
    const categories=Array.isArray(item.categories)?
      item.categories.filter(x=>typeof x==='string'&&/^[a-z0-9 -]{1,36}$/.test(x)).slice(0,8):[];
    accepted.set(site,{
      site,name,slug:item.name,description:clean(item.description,260),categories
    });
  }
  if(accepted.size<15)throw Error('Aceternity official component entries failed source validation');
  return [...accepted.values()];
}
export function rankAceternityOriginals(brief,items,{limit=4,includeAll=false}={}){
  const query=words(String(brief||'').slice(0,1400)).slice(0,28);
  if(!query.length&&!includeAll)return [];
  return items.map(item=>{
    if(!validateAceternityComponentUrl(item.site,item.slug))return null;
    const title=words(item.name+' '+item.slug);
    const descriptions=words(item.description);
    const categories=words((item.categories||[]).join(' '));
    const a=new Set(title),b=new Set(descriptions),c=new Set(categories);
    let score=0;
    for(const word of query){
      if(a.has(word))score+=7;
      if(b.has(word))score+=2;
      if(c.has(word))score+=1;
    }
    score+=publisherComponentIntentBoost(brief,item.name);
    return score||includeAll?{...item,relevanceScore:score}:null;
  }).filter(Boolean).sort((a,b)=>b.relevanceScore-a.relevanceScore||
    a.site.localeCompare(b.site))
    .slice(0,Math.max(1,Math.min(includeAll?300:26,limit))).map(item=>({
      id:'live_'+crypto.createHash('sha256').update(item.site).digest('hex').slice(0,24),
      name:item.name,site:item.site,provider:'Aceternity UI',
      sourceId:'aceternity',sourceKind:'animation',
      category:'Original UI component / animation',
      tags:[...new Set([...item.categories,...words(item.description).slice(0,10)])],
      styles:[],summary:item.description,componentName:item.slug,
      componentCategory:item.categories[0]||'component',
      relevanceScore:item.relevanceScore,
      originalPrompt:null,originalPromptUrl:null,originalPromptStatus:'not-published',
      provenance:'Component and original documentation link from Aceternity UI official JSON API. No prompt, screenshot, or component code is fabricated or copied.'
    }));
}
export async function findAceternityOriginalComponents(brief,{
  transport=fetch,now=()=>Date.now(),limit=4,includeAll=false}={}){
  if(cache.expires<=now()){
    if(!inFlight)inFlight=(async()=>{
      const response=await transport(ENDPOINT,{
        method:'GET',redirect:'error',
        headers:{Accept:'application/json'},
        signal:AbortSignal.timeout(6500)
      });
      if(!response.ok)throw Error('Aceternity publisher API HTTP '+response.status);
      const size=Number(response.headers?.get('content-length')||0);
      if(size>MAX_RESPONSE_BYTES)throw Error('Official JSON source too large');
      // Streaming limits the number of bytes read; never trust Content-Length
      // alone from an external provider.
      const body=await response.text();
      if(Buffer.byteLength(body,'utf8')>MAX_RESPONSE_BYTES)throw Error('Source JSON exceeded size limit');
      return parseAceternityOfficialCatalogue(JSON.parse(body));
    })().finally(()=>{inFlight=null;});
    try{
      cache.items=await inFlight;cache.expires=now()+TTL_MS;
    }catch{
      cache.items=[];cache.expires=0;
      return {status:'unavailable',matches:[],
        note:'Official Aceternity component index could not be verified; no suggestions invented.'};
    }
  }
  const matches=rankAceternityOriginals(brief,cache.items,{limit,includeAll});
  return {status:matches.length?'ready':'no-matches',matches,
    note:'Only original Aceternity JSON catalogue component pages were used; no source prompt was supplied.'};
}
export function clearAceternityCacheForTests(){cache.items=[];cache.expires=0;inFlight=null;}
