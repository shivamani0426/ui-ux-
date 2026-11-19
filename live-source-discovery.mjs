import crypto from 'node:crypto';
import {findKageOriginals} from './kage-publisher.mjs';

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
// Only publisher-native MCP access is used. Generic search-engine results
// must not be stored, cached as a permanent catalogue or presented as source
// prompts. Publishers without authorized APIs remain honest source links.
const cache=new Map(),pending=new Map(),requests=[];
const TTL=4*60*1000,MAX_RUNS=12;
export function clearDiscoveryCacheForTests(){cache.clear();pending.clear();requests.length=0;}
export async function discoverLiveSources(brief,{
  transport=fetch,now=()=>Date.now(),providers=LIVE_SOURCES,limit=3}={}){
  const query=discoveryTerms(brief);
  const directories=providers.map(({id,name,host,kind})=>({
    id,name,website:'https://'+host+'/',kind,
    mode:id==='kage'?'official-mcp':'original-link-only'
  }));
  // Deterministic browser tests must not contact external services.
  if(process.env.NODE_ENV==='test'&&process.env.FRONTLINE_KAGE_TEST_MOCK!=='1'&&transport===fetch)
    return {status:'not-configured',query,matches:[],sources:directories,
      note:'Publisher calls are disabled in test mode; no fabricated matches.',
      providerStatus:directories.map(x=>({id:x.id,status:'test-disabled',count:0}))};
  const key=crypto.createHash('sha256').update(query+'|kage').digest('hex');
  const cached=cache.get(key);
  if(cached&&cached.expires>now())return cached.data;
  if(pending.has(key))return pending.get(key);
  const current=now();
  while(requests.length&&requests[0]<current-3600000)requests.shift();
  if(requests.length>=MAX_RUNS)
    return {status:'rate-limited',query,matches:[],sources:directories,
      note:'Publisher lookup budget reached; open original sites or retry later.'};
  requests.push(current);
  const work=(async()=>{
    let raw,available=false;
    try{raw=await findKageOriginals(query,{transport,limit});available=true;}
    catch{raw={status:'unavailable',matches:[]};}
    const kage=LIVE_SOURCES.find(x=>x.id==='kage');
    const references=(raw.matches||[]).map(match=>{
      const source=indexedReference(matchToCandidate(match),kage);
      return source?{
        ...source,
        provenance:'Official Kage MCP search result with original design URL.',
        originalPrompt:match.originalPromptStatus==='verified-publisher'?match.originalPrompt:null,
        originalPromptHash:match.originalPromptHash,
        originalPromptStatus:match.originalPromptStatus,
        originalPromptOrigin:match.originalPromptOrigin
      }:null;
    }).filter(Boolean);
    const status=references.length?'partial':available?'no-matches':'unavailable';
    const result={status,query,matches:references,sources:directories,
      providerStatus:directories.map(d=>({id:d.id,
        status:d.id==='kage'?(available?raw.status:'unavailable'):'link-only',
        count:d.id==='kage'?references.length:0})),
      note:references.length?
        'Kage prompts come from the original publisher MCP. The other sources are direct links until their own authorized prompt integrations are available.':
        'No authentic publisher results were retrieved; Frontline will not invent links, titles or prompts.'};
    if(available){
      if(cache.size>=32)cache.delete(cache.keys().next().value);
      cache.set(key,{data:result,expires:now()+TTL});
    }
    return result;
  })();
  pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}
function matchToCandidate(match){
  return {url:match.url,title:match.title};
}
