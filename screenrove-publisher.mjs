import crypto from 'node:crypto';
import {rankPublisherEvidence,isUnusablePublisherPage} from './publisher-evidence-relevance.mjs';

// Official publisher MCP: https://screenrove.com/agents
// Read-only Screenrove tools, with no key, account, scraping or guessed URLs.
const ENDPOINT='https://screenrove.com/mcp';
const PROTOCOL='2025-03-26';
const MAX_REPLY=620_000;
const cache=new Map();
const pending=new Map();
const TTL=5*60*1000;
const clean=(v,n=250)=>String(v??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export function validScreenrovePage(value){
  if(typeof value!=='string'||value.length>750)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.hostname!=='screenrove.com'||u.port||u.username||
       u.password||u.hash||u.pathname==='/'||!/^\/[a-z0-9/-]+\/?$/.test(u.pathname)||
       /^\/(api|mcp|admin|login|account|privacy|agents)(\/|$)/.test(u.pathname))return null;
    // Preserve provider-issued deep-link IDs, but never accept arbitrary query params.
    if([...u.searchParams.keys()].some(k=>!['open','view','tag','page'].includes(k)))return null;
    if([...u.searchParams.values()].some(v=>v.length>90||!/^[a-z0-9,~:_-]+$/i.test(v)))return null;
    return u.href;
  }catch{return null;}
}
async function decode(response){
  const raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>MAX_REPLY)throw Error('Screenrove MCP response too large');
  const frames=response.headers?.get?.('content-type')?.includes('event-stream')||
    raw.trim().startsWith('event:')||raw.trim().startsWith('data:')
    ?raw.split(/\r?\n/).filter(line=>line.startsWith('data:'))
      .map(line=>line.slice(5).trim()).filter(Boolean)
    :[raw];
  for(const frame of frames.reverse()){
    if(frame==='[DONE]')continue;
    let payload;try{payload=JSON.parse(frame)}catch{continue;}
    if(payload.error)throw Error('Screenrove MCP returned an error');
    if(payload.result!==undefined)return payload.result;
  }
  throw Error('Screenrove MCP response not recognized');
}
export function createScreenroveClient({transport=fetch,timeoutMs=7000}={}){
  let session='',seq=0;
  const post=async(method,params={},notification=false)=>{
    const response=await transport(ENDPOINT,{
      method:'POST',redirect:'error',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream',
        'MCP-Protocol-Version':PROTOCOL,...(session?{'Mcp-Session-Id':session}:{})},
      body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id:++seq}),method,params})
    });
    if(!response.ok)throw Error('Screenrove MCP HTTP '+response.status);
    session=response.headers?.get?.('mcp-session-id')||session;
    if(notification)return null;
    return decode(response);
  };
  return {
    async initialize(){
      await post('initialize',{protocolVersion:PROTOCOL,capabilities:{},
        clientInfo:{name:'frontline-original-source-reader',version:'1.0'}});
      await post('notifications/initialized',{},true);
    },
    call:(name,args)=>post('tools/call',{name,arguments:args})
  };
}
export function screenroveToolData(reply){
  if(!reply||reply.isError)return null;
  if(reply.structuredContent&&typeof reply.structuredContent==='object')
    return reply.structuredContent;
  for(const item of reply.content||[]){
    if(item?.type!=='text'||typeof item.text!=='string'||item.text.length>MAX_REPLY)continue;
    try{return JSON.parse(item.text)}catch{}
  }
  return reply;
}
const entriesFrom=reply=>{
  const data=screenroveToolData(reply);
  for(const item of [data,data?.data,data?.result]){
    if(Array.isArray(item?.screens))return item.screens;
    if(Array.isArray(item?.results))return item.results;
  }
  return [];
};
const detailFrom=reply=>{
  const data=screenroveToolData(reply);
  return data?.screen||data?.data?.screen||data?.data||data?.result?.screen||data;
};
export function verifiedScreenroveReference(search,detail,expectedKind){
  if(!search||typeof search!=='object'||!['product','marketing'].includes(expectedKind))return null;
  const record=detail&&typeof detail==='object'?detail:{};
  const id=clean(search.id||search.screenId,135);
  // Never construct a URL from a screen ID or a product name.
  const page=validScreenrovePage(record.url||record.pageUrl||record.referenceUrl||
    record.reference_url||record.page_url||search.url||search.pageUrl||search.referenceUrl||'');
  // Publisher-reported search and detail pages must agree when both provided.
  const searchPage=validScreenrovePage(search.url||search.pageUrl||'');
  if(searchPage&&searchPage!==page)return null;
  if(!id||!page)return null;
  const returnedId=clean(record.id||record.screenId||record.screen_id||'',135);
  if(returnedId&&returnedId!==id)return null;
  const kind=clean(search.kind||record.kind,20);
  if(kind&&kind!==expectedKind)return null;
  const product=clean(search.productName||record.productName||search.product||'',45);
  const screenTitle=clean(search.title||record.title,75);
  const title=clean(product&&screenTitle&&!screenTitle.toLowerCase().startsWith(product.toLowerCase())?
    product+' — '+screenTitle:screenTitle||product,100);
  if(title.length<3)return null;
  const summary=clean(search.notes||record.notes||record.description,230);
  const designType=expectedKind==='product'?'application-ui':'landing-page';
  return {
    id:'live_'+crypto.createHash('sha256').update(page).digest('hex').slice(0,24),
    name:title,site:page,provider:'Screenrove',sourceId:'screenrove',
    sourceKind:'inspiration',designType,publisherVerified:true,
    category:expectedKind==='product'?'Original application UI':'Original landing page',
    summary,provenance:'Publisher-returned Screenrove screen page. Observed screen reference, not a publisher design prompt.',
    originalPrompt:null,originalPromptUrl:null,originalPromptStatus:'not-published',
    tags:[],styles:[],relevanceScore:0
  };
}
export function clearScreenroveCacheForTests(){cache.clear();pending.clear();}
export async function searchScreenroveReferences({appQuery,landingQuery,appQueries=[],landingQueries=[],brief=''}={},{
  transport=fetch,now=()=>Date.now(),limitPerKind=2,candidateMode=false}={}){
  const app=clean(appQuery,105),landing=clean(landingQuery,105);
  const querySet=(first,other)=>[...new Set([first,...(Array.isArray(other)?other:[])]
    .map(x=>clean(x,105)).filter(Boolean))].slice(0,candidateMode?2:1);
  const products=querySet(app,appQueries),marketing=querySet(landing,landingQueries);
  if(!products.length&&!marketing.length)return {status:'no-queries',matches:[],providerStatus:[]};
  const key=crypto.createHash('sha256').update(products.join('|')+'||'+marketing.join('|')+
    '||'+clean(brief,7000)+'|'+candidateMode).digest('hex');
  const cached=cache.get(key);
  if(cached&&cached.expires>now())return cached.result;
  if(pending.has(key))return pending.get(key);
  const work=(async()=>{
    const client=createScreenroveClient({transport});
    let up=false;
    try{
      await client.initialize();up=true;
      // Search by distinct user jobs and interface patterns, not by one
      // memorized industry query. Every returned URL still needs get_screen.
      const pairs=[...products.map(q=>['product',q]),...marketing.map(q=>['marketing',q])];
      const searches=await Promise.all(pairs.map(async([kind,q])=>{
        try{
          const response=await client.call('search_screens',{q,kind,limit:Math.max(3,Math.min(8,limitPerKind*3)),images:0});
          return {kind,found:entriesFrom(response).slice(0,Math.min(8,limitPerKind*3)),status:'ready'};
        }catch{return {kind,found:[],status:'unavailable'};}
      }));
      // Verify a wider, diverse candidate pool when the AI evaluator will
      // judge actual suitability. Default library calls retain conservative
      // lexical filtering so older non-AI flows remain safe.
      const context=brief||products.join(' ')+' '+marketing.join(' ');
      const grouped=await Promise.all(['product','marketing'].map(async kind=>{
        const groups=searches.filter(x=>x.kind===kind).map(x=>x.found);
        // Interleave genuine publisher hits from both query strategies so a
        // broad first search cannot crowd out a more precise second search.
        const alternated=[];
        const longest=Math.max(0,...groups.map(g=>g.length));
        for(let index=0;index<longest;index++)
          for(const group of groups)if(group[index])alternated.push(group[index]);
        const found=[...new Map(alternated.filter(x=>x&&x.id)
          .map(x=>[x.id,x])).values()];
        const annotated=found.map(item=>({
          ...item,name:item.title||item.name,summary:item.notes||item.description||''
        })).filter(item=>!isUnusablePublisherPage(item,context));
        const ranked=candidateMode?annotated.slice(0,Math.max(6,limitPerKind+2)):
          rankPublisherEvidence(context,annotated,{limit:Math.max(4,limitPerKind*2)});
        const detailed=await Promise.all(ranked.map(async item=>{
          try{
            const record=detailFrom(await client.call('get_screen',{screenId:item.id}));
            return verifiedScreenroveReference(item,record,kind);
          }catch{return null;}
        }));
        const verified=detailed.filter(Boolean)
          .filter(x=>!isUnusablePublisherPage(x,context));
        return candidateMode?verified.slice(0,limitPerKind):
          rankPublisherEvidence(context,verified,{limit:limitPerKind});
      }));
      const matches=[...new Map(grouped.flat().map(x=>[x.site,x])).values()];
      const result={status:matches.length?'ready':searches.some(x=>x.status==='unavailable')?'unavailable':'no-matches',
        matches,providerStatus:searches.map(x=>({id:'screenrove-'+x.kind,status:x.status,
          count:matches.filter(m=>m.designType===(x.kind==='product'?'application-ui':'landing-page')).length}))};
      if(cache.size>40)cache.delete(cache.keys().next().value);
      cache.set(key,{result,expires:now()+TTL});
      return result;
    }catch{
      return {status:'unavailable',matches:[],providerStatus:[],
        note:up?'Screenrove search unavailable.':'Screenrove MCP connection unavailable.'};
    }
  })();
  pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}
