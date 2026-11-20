import crypto from 'node:crypto';
import {trustedPublisherLink} from './simple-discovery-chat.mjs';
import {isUnusablePublisherPage,rankPublisherEvidence} from './publisher-evidence-relevance.mjs';

// Deliberately domain-independent: source names and metadata are never a list
// of recognized problems. Models can only approve actual publisher IDs.
// Relevance decisions cannot create a publisher URL or publisher prompt.
const TTL_MS=5*60_000;
const cache=new Map();
const text=(value,limit=200)=>String(value??'')
  .replace(/[\u0000-\u001f\u007f<>|]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
const kind=x=>x.provider==='Kage'?'landing-page':x.designType;
const candidatesOf=(items,brief='')=>{
  const seen=new Set();
  return (Array.isArray(items)?items:[]).filter(item=>{
    if(!item||!['application-ui','landing-page'].includes(kind(item))||
       !trustedPublisherLink(item)||isUnusablePublisherPage(item,brief))return false;
    if(seen.has(item.site))return false;
    seen.add(item.site);return true;
  }).slice(0,28);
};
export function publisherCandidateCatalog(items){
  return items.slice(0,24).map((x,i)=>{
    const summary=text(x.summary,340);
    const verifiedPrompt=x.provider==='Kage'&&
      x.originalPromptStatus==='verified-publisher'?text(x.originalPrompt,480):'';
    return [i,kind(x),text(x.provider,30),text(x.name,125),summary,verifiedPrompt]
      .join(' | ');
  }).join('\n').slice(0,15_000);
}
export function parsePublisherEvaluation(answer,items,{maxApp=2,maxLanding=3,brief=''}={}){
  const raw=typeof answer==='string'?answer:answer?.text;
  if(typeof raw!=='string'||raw.length>14_000)return null;
  try{
    const fence=String.fromCharCode(96).repeat(3);
    let data=raw.trim();
    if(data.startsWith(fence))data=data.replace(/^.{3}(?:json)?\s*/i,'').replace(/\s*.{3}$/,'');
    const payload=JSON.parse(data);
    if(!payload||!Array.isArray(payload.choices)||payload.choices.length>15)return null;
    const seen=new Set(),app=[],landing=[];
    for(const choice of payload.choices){
      if(!choice||!Number.isInteger(choice.index)||choice.index<0||
         choice.index>=items.length||seen.has(choice.index))continue;
      seen.add(choice.index);
      const item=items[choice.index];
      if(isUnusablePublisherPage(item,brief))continue;
      // A usable pattern must be genuinely applicable, not a visual
      // resemblance or merely two shared buzzwords.
      if(!Number.isInteger(choice.fit)||choice.fit<4||choice.fit>5)continue;
      const reason=text(choice.reason,210);
      if(reason.length<24||/https?:\/\/|perfect match|guaranteed|verified usability/i.test(reason))continue;
      const selected={...item,relevanceAccepted:true,
        relevanceScore:choice.fit*20,matchReason:reason};
      const bucket=kind(item)==='application-ui'?app:landing;
      if(bucket.length<(bucket===app?maxApp:maxLanding))bucket.push(selected);
    }
    return {applicationMatches:app,landingMatches:landing,status:'semantic-evaluated',
      inspected:items.length};
  }catch{return null;}
}
export async function evaluatePublisherSources(brief,candidates,{model=null,now=()=>Date.now()}={}){
  const pool=candidatesOf(candidates,brief);
  if(!pool.length)return {applicationMatches:[],landingMatches:[],
    status:'no-verified-candidates',inspected:0};
  const fingerprint=crypto.createHash('sha256').update(String(brief||'').slice(0,7000)+
    '\n'+pool.map(x=>x.site+'|'+x.name+'|'+x.summary).join('\n')).digest('hex');
  const previous=cache.get(fingerprint);
  if(previous&&previous.expiry>now())return previous.value;
  if(typeof model==='function'){
    try{
      const raw=await model({brief:String(brief||'').slice(0,7000),
        sourceCatalog:publisherCandidateCatalog(pool)});
      const parsed=parsePublisherEvaluation(raw,pool,{brief});
      if(parsed){
        if(cache.size>=48)cache.delete(cache.keys().next().value);
        cache.set(fingerprint,{expiry:now()+TTL_MS,value:parsed});
        return parsed;
      }
    }catch{/* Genuine source-only fallback below, never invented references. */}
  }
  // A provider outage is not permission to turn unrelated generic UI pages
  // into strong recommendations. Conservative publisher metadata evidence only.
  const app=rankPublisherEvidence(brief,pool.filter(x=>kind(x)==='application-ui'),{limit:2});
  const landing=rankPublisherEvidence(brief,pool.filter(x=>kind(x)==='landing-page'),{limit:3});
  const mark=items=>items.map(x=>({...x,relevanceAccepted:true,
    matchReason:'Publisher metadata overlaps with requested tasks; AI relevance review was unavailable.'}));
  return {applicationMatches:mark(app),landingMatches:mark(landing),
    status:'metadata-fallback',inspected:pool.length};
}
export function clearPublisherEvaluationCacheForTests(){cache.clear();}
