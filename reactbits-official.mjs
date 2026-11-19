import crypto from 'node:crypto';

// Publisher-maintained machine-readable catalogue. No scraped galleries,
// copied component code or hard-coded result pages.
const DOCS='https://reactbits.dev/sitemap.xml';
const MAX_BYTES=220_000,TTL=12*60*1000;
const STOP=new Set(('create build make website application app ui ux react design interactive '+
  'with from about for the this that need want please modern great good '+
  'your them into have show user users use using style styles implement original').split(' '));
const cache={expires:0,entries:[]};
let pending=null;
const clean=v=>String(v||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').trim();
const tokens=s=>[...new Set((clean(s).toLowerCase().match(/[a-z]{3,30}/g)||[]).filter(t=>!STOP.has(t)))];
const allowedUrl=v=>{
  try{
    const u=new URL(v);
    if(u.protocol!=='https:'||!['reactbits.dev','www.reactbits.dev'].includes(u.hostname.toLowerCase())||
      u.port||u.username||u.password||u.search||u.hash)return null;
    if(!/^\/(components|animations|backgrounds|text-animations|micro)\/[a-z0-9-]+$/.test(u.pathname))return null;
    return u.href;
  }catch{return null;}
};
export function parseReactBitsPublisherCatalogue(markdown){
  if(typeof markdown!=='string'||Buffer.byteLength(markdown,'utf8')>MAX_BYTES)
    throw Error('React Bits official catalogue missing or oversized');
  const items=new Map();
  let category='';
  for(const line of markdown.split(/\r?\n/)){
    const heading=line.match(/^##\s+(Components|Animations|Backgrounds|Text Animations)\s*$/);
    if(heading){category=heading[1];continue;}
    if(!['Components','Animations','Backgrounds','Text Animations'].includes(category))continue;
    const match=line.match(/^-\s+\[([^\]]{2,100})\]\((https:\/\/[^ )]{8,250})\):\s*(.{5,400}?)\s+CLI:\s*\x60([A-Za-z][A-Za-z0-9]{2,70})\x60\.\s*$/);
    if(!match)continue;
    const site=allowedUrl(match[2]);
    if(!site||items.has(site))continue;
    const kind=new URL(site).pathname.split('/')[1];
    if(kind!=={'Components':'components','Animations':'animations',
      'Backgrounds':'backgrounds','Text Animations':'text-animations'}[category])continue;
    items.set(site,{site,name:clean(match[1]).slice(0,90),description:clean(match[3]).slice(0,330),
      componentName:match[4],category});
  }
  return [...items.values()];
}
// The current first-party sitemap contains exact published component pages.
// Its llms.txt is now a short documentation intro, not a component catalogue.
export function parseReactBitsPublisherSitemap(xml){
  if(typeof xml!=='string'||Buffer.byteLength(xml,'utf8')>MAX_BYTES)
    throw Error('React Bits official sitemap missing or oversized');
  const entries=new Map();
  const links=[...xml.matchAll(/<loc>\s*(https:\/\/[^<\s]+)\s*<\/loc>/g)].map(x=>x[1]);
  if(!links.length)throw Error('React Bits sitemap has no original URLs');
  for(const source of links){
    const site=allowedUrl(source);
    if(!site||entries.has(site))continue;
    const parts=new URL(site).pathname.split('/').filter(Boolean);
    const slug=parts[1],name=slug.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');
    entries.set(site,{site,name,description:'',
      componentName:slug,category:parts[0]});
  }
  return [...entries.values()];
}
export function rankReactBitsOriginalComponents(brief,entries,{limit=3}={}){
  const query=tokens(brief).slice(0,12);
  if(!query.length)return [];
  return entries.map(item=>{
    if(!allowedUrl(item?.site)||typeof item.name!=='string')return null;
    const title=new Set(tokens(item.name)),description=new Set(tokens(item.description));
    let score=0;
    for(const word of query){if(title.has(word))score+=5;if(description.has(word))score+=2;}
    return score?{...item,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name))
    .slice(0,Math.max(1,Math.min(6,limit))).map(item=>{
      const id='live_'+crypto.createHash('sha256').update(item.site).digest('hex').slice(0,24);
      return {id,name:item.name,site:item.site,provider:'React Bits',
        sourceId:'reactbits',sourceKind:'animation',category:'Original component / animation',
        tags:tokens(item.description).slice(0,15),styles:[],summary:item.description,
        componentName:item.componentName,componentCategory:item.category,
        relevanceScore:item.score,originalPrompt:null,originalPromptUrl:null,
        originalPromptStatus:'not-published',provenance:
          'From the official React Bits publisher catalogue. No prompt or component code was invented or copied.'};
    });
}
export async function findReactBitsOriginalComponents(brief,{
  transport=fetch,now=()=>Date.now(),limit=3}={}){
  if(cache.expires<=now()){
    if(!pending)pending=(async()=>{
      const res=await transport(DOCS,{method:'GET',headers:{Accept:'application/xml, text/xml'},
        redirect:'error',signal:AbortSignal.timeout(6500)});
      if(!res.ok)throw Error('React Bits publisher index HTTP '+res.status);
      const size=Number(res.headers?.get('content-length')||0);
      if(size>MAX_BYTES)throw Error('React Bits index too large');
      const list=parseReactBitsPublisherSitemap(await res.text());
      if(list.length<20)throw Error('React Bits publisher index not recognized');
      return list;
    })().finally(()=>{pending=null;});
    try{
      const entries=await pending;
      cache.entries=entries;cache.expires=now()+TTL;
    }catch{
      cache.entries=[];cache.expires=0;
      return {status:'unavailable',matches:[],note:'React Bits original index unavailable'};
    }
  }
  const matches=rankReactBitsOriginalComponents(brief,cache.entries,{limit});
  return {status:matches.length?'ready':'no-matches',matches,
    note:'Names and page links came from the publisher index; no original prompts were claimed.'};
}
export function clearReactBitsCacheForTests(){cache.entries=[];cache.expires=0;pending=null;}
