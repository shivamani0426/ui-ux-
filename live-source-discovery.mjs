import crypto from 'node:crypto';

// M08 Live discovery: use an authorized search-index API; NEVER invent results,
// crawl a restricted gallery, infer that a prompt exists, or copy source code.
export const LIVE_SOURCES=Object.freeze([
  {id:'reactbits',name:'React Bits',host:'reactbits.dev',kind:'animation'},
  {id:'aceternity',name:'Aceternity UI',host:'ui.aceternity.com',kind:'animation'},
  {id:'codrops',name:'Codrops',host:'tympanus.net',prefix:'/codrops/',kind:'animation'},
  {id:'animata',name:'Animata',host:'animata.design',kind:'animation'},
  {id:'uiverse',name:'Uiverse',host:'uiverse.io',kind:'animation'},
  {id:'magicui',name:'Magic UI',host:'magicui.design',kind:'animation'},
  {id:'awwwards',name:'Awwwards',host:'awwwards.com',kind:'animation'},
  {id:'kage',name:'Kage',host:'kage.design',kind:'inspiration'},
  {id:'21st',name:'21st.dev',host:'21st.dev',kind:'inspiration'},
  {id:'refero',name:'Refero',host:'refero.design',kind:'inspiration'},
  {id:'mobbin',name:'Mobbin',host:'mobbin.com',kind:'inspiration'},
  {id:'landingfolio',name:'Landingfolio',host:'landingfolio.com',kind:'inspiration'},
  {id:'lapa',name:'Lapa Ninja',host:'lapa.ninja',kind:'inspiration',linkOnly:true},
  {id:'pageflows',name:'Page Flows',host:'pageflows.com',kind:'inspiration'}
]);

const STOP=new Set('a an the and to for in on at of from with without make build create design website web app application ui ux i we our your user users want need please do give show that this would should can will have has by as into about like'.split(' '));
const restrictedPath=/^\/(?:login|signup|sign-up|register|admin|account|auth|checkout|pricing|privacy|terms|search|api)(?:\/|$)/i;
const safeText=(v,max=160)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function discoveryTerms(brief){
  const clean=String(brief||'').slice(0,2000).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,' ')
    .replace(/https?:\/\/\S+/gi,' ').toLowerCase();
  const tokens=clean.match(/[a-z]{3,20}/g)||[];
  return [...new Set(tokens.filter(t=>!STOP.has(t)))].slice(0,7).join(' ')||'interface component';
}
export function canonicalIndexedUrl(value,provider){
  if(typeof value!=='string'||value.length>1200)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')return null;
    const host=url.hostname.toLowerCase();
    if(host!==provider.host&&host!=='www.'+provider.host)return null;
    if(provider.prefix&&!url.pathname.startsWith(provider.prefix))return null;
    if(url.pathname==='/'||restrictedPath.test(url.pathname))return null;
    if(/\.(?:exe|zip|rar|pdf|csv|json|xml|png|jpg|jpeg|gif|webp)$/i.test(url.pathname))
      return null;
    url.hash='';url.search='';
    return url.href.slice(0,600);
  }catch{return null;}
}
const styleTags=title=>{
  const words=title.toLowerCase();
  return ['minimal','glass','creative'].filter(t=>new RegExp('\\b'+t+'\\b').test(words));
};
export function indexedReference(candidate,provider){
  const site=canonicalIndexedUrl(candidate?.url,provider);
  const title=safeText(candidate?.title,120);
  if(!site||title.length<4)return null;
  const stableId='live_'+crypto.createHash('sha256').update(site).digest('hex').slice(0,24);
  const tags=[...new Set(title.toLowerCase().match(/[a-z]{4,20}/g)||[])].slice(0,16);
  return {
    id:stableId,name:title,site,award:null,
    category:provider.kind==='animation'?'UI components & motion':'Design inspiration',
    provider:provider.name,sourceId:provider.id,sourceKind:provider.kind,
    tags,styles:styleTags(title),summary:'',rank:null,score:null,
    provenance:'Found through a third-party search index. Open the original source to confirm current details.',
    // No source-authorized prompt API connected. NEVER synthesize prompt text.
    originalPrompt:null,originalPromptUrl:null,originalPromptStatus:'not-verified',
    indexVerified:true
  };
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
async function searchSource(provider,terms,{key,transport,signal}){
  const url=new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q','site:'+provider.host+' '+terms+
    (provider.kind==='animation'?' animation component':' interface design'));
  url.searchParams.set('count','5');
  url.searchParams.set('safesearch','strict');
  url.searchParams.set('text_decorations','false');
  try{
    const res=await transport(url.toString(),{method:'GET',
      headers:{Accept:'application/json','X-Subscription-Token':key},
      redirect:'error',signal});
    if(!res.ok)return {provider:provider.name,id:provider.id,status:res.status===429?'rate-limited':'unavailable',results:[]};
    const data=await res.json();
    const items=Array.isArray(data.web?.results)?data.web.results:[];
    const unique=new Map();
    for(const item of items){
      const mapped=indexedReference(item,provider);
      if(mapped&&!unique.has(mapped.id))unique.set(mapped.id,mapped);
    }
    return {provider:provider.name,id:provider.id,status:'searched',results:[...unique.values()].slice(0,3)};
  }catch{return {provider:provider.name,id:provider.id,status:'unavailable',results:[]};}
}
const ttl=8*60*1000;
const cache=new Map();
const pending=new Map();
const discoveryRuns=[];
const runsPerHour=24; // 24 source searches * 14 provider queries = max 336 paid queries/hr/instance.
export function clearDiscoveryCacheForTests(){cache.clear();pending.clear();discoveryRuns.length=0;}
export async function discoverLiveSources(brief,{apiKey=process.env.FRONTLINE_BRAVE_SEARCH_API_KEY||'',
  transport=fetch,now=()=>Date.now(),providers=LIVE_SOURCES,timeoutMs=5000}={}){
  const terms=discoveryTerms(brief);
  const directories=providers.map(({id,name,host,kind})=>({
    id,name,website:'https://'+host+'/',kind
  }));
  if(typeof apiKey!=='string'||apiKey.trim().length<16)
    return {status:'not-configured',query:terms,matches:[],sources:directories,
      note:'Live inspiration discovery needs an authorized search API. No archived or fabricated references will be substituted.'};
  const key=crypto.createHash('sha256').update(terms+'|'+providers.map(p=>p.id).join('|')).digest('hex');
  const record=cache.get(key);
  if(record&&record.expires>now())return record.data;
  if(pending.has(key))return pending.get(key);
  const current=now();
  while(discoveryRuns.length&&discoveryRuns[0]<current-3600000)discoveryRuns.shift();
  if(discoveryRuns.length>=runsPerHour)
    return {status:'rate-limited',query:terms,matches:[],sources:directories,
      note:'Hourly live-search budget reached; open the publisher links or retry later.'};
  discoveryRuns.push(current);
  const run=(async()=>{
    const jobs=[];
    const concurrency=4;
    let next=0;
    async function worker(){
      while(next<providers.length){
        const index=next++,provider=providers[index];
        const timeout=AbortSignal.timeout(clamp(timeoutMs,500,8000));
        jobs[index]=await searchSource(provider,terms,{key:apiKey,transport,signal:timeout});
      }
    }
    await Promise.all(Array.from({length:Math.min(concurrency,providers.length)},worker));
    const seen=new Set(),matches=[];
    for(const job of jobs){
      for(const result of job.results){
        if(!seen.has(result.id)){seen.add(result.id);matches.push(result);}
      }
    }
    const successes=jobs.filter(x=>x.status==='searched').length;
    const status=successes===0?'unavailable':successes<jobs.length?'partial':
      matches.length?'ready':'no-matches';
    const result={status,query:terms,matches,sources:directories,
      providerStatus:jobs.map(({provider,id,status,results})=>({provider,id,status,count:results.length})),
      note:status==='partial'?'Some providers were unreachable; no substitute results were fabricated.':
        status==='unavailable'?'The search provider is unavailable. Please use the original source links.':
        'Results are from the search index, not cloned websites; no third-party original prompt has been verified.'};
    if(cache.size>=60)cache.delete(cache.keys().next().value);
    if(status==='ready'||status==='no-matches'||status==='partial')
      cache.set(key,{data:result,expires:now()+ttl});
    return result;
  })();
  pending.set(key,run);
  try{return await run;}finally{pending.delete(key);}
}
