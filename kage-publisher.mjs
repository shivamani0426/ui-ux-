import crypto from 'node:crypto';

// Official, public Kage MCP server. Never scrape or bulk-mirror the library.
const ENDPOINT='https://kage.design/mcp';
const PROTOCOL='2025-06-18';
const MAX_REPLY_BYTES=350_000;
const MAX_PROMPT_BYTES=45_000;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeWord=x=>typeof x==='string'?x.trim():'';
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedUrl=s=>{
  try{
    const u=new URL(s);
    if(u.protocol!=='https:'||u.hostname!=='kage.design'||u.port||u.search||u.hash||
      u.username||u.password)return null;
    const m=u.pathname.match(/^\/(designs|component)\/([a-z0-9-]+)\/?$/);
    return m&&slugPattern.test(m[2])?u.origin+'/'+m[1]+'/'+m[2]:null;
  }catch{return null;}
};
export function sourceUrlForKage(item){
  if(!isObject(item))return null;
  for(const value of [item.url,item.link,item.site,item.designUrl,item.design_url]){
    const url=allowedUrl(value);
    if(url&&url.includes('/designs/'))return url;
  }
  const slug=safeWord(item.slug||item.design_slug||item.designSlug);
  return slugPattern.test(slug)?'https://kage.design/designs/'+slug:null;
}
async function decodeRpcResponse(response){
  const size=Number(response.headers?.get?.('content-length')||0);
  if(size>MAX_REPLY_BYTES)throw Error('MCP response exceeds size limit');
  const raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>MAX_REPLY_BYTES)throw Error('MCP response too large');
  const payloads=raw.trim().startsWith('data:')||response.headers?.get?.('content-type')?.includes('text/event-stream')
    ?raw.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).filter(Boolean)
    :[raw];
  for(const payload of payloads.reverse()){
    if(payload==='[DONE]')continue;
    let data;try{data=JSON.parse(payload)}catch{continue;}
    if(data.error)throw Error('Publisher MCP request rejected');
    if(data.result!==undefined)return data.result;
  }
  throw Error('Publisher MCP returned no valid result');
}
export function createMcpClient({transport=fetch,endpoint=ENDPOINT,timeoutMs=6500}={}){
  if(endpoint!==ENDPOINT&&transport===fetch)
    throw Error('Publisher MCP host must be Kage');
  let session='';
  async function post(method,params={},notification=false){
    const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream',
      'MCP-Protocol-Version':PROTOCOL,...(session?{'Mcp-Session-Id':session}:{})};
    const message={jsonrpc:'2.0',...(notification?{}:{id:crypto.randomUUID()}),method,params};
    const response=await transport(endpoint,{method:'POST',headers,body:JSON.stringify(message),
      redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok)throw Error('Publisher MCP request failed with HTTP '+response.status);
    session=response.headers?.get?.('mcp-session-id')||session;
    if(notification)return null;
    return decodeRpcResponse(response);
  }
  return {
    async discoverTools(){
      await post('initialize',{protocolVersion:PROTOCOL,
        capabilities:{},clientInfo:{name:'frontline-source-reader',version:'0.1.0'}});
      await post('notifications/initialized',{},true);
      const data=await post('tools/list',{});
      if(!Array.isArray(data?.tools))throw Error('Kage did not advertise tools');
      return data.tools;
    },
    call:(name,args)=>post('tools/call',{name,arguments:args})
  };
}
function buildArgs(tool,values){
  const props=tool?.inputSchema?.properties||{};
  const required=tool?.inputSchema?.required||[];
  const args={};
  for(const [candidates,value] of values){
    const key=candidates.find(k=>Object.hasOwn(props,k));
    if(key)args[key]=value;
  }
  if(required.some(k=>!(k in args)))return null;
  return args;
}
export function toolArguments(tool,mode,query){
  return mode==='search'?buildArgs(tool,[
    [['query','q','search','text','brief','description','prompt'],query],
    [['limit','count','max_results','maxResults','top_k'],3]
  ]):buildArgs(tool,[[['slug','design_slug','designSlug','id','name'],query]]);
}
function parseToolContent(response){
  if(!response||response.isError)return null;
  if(isObject(response.structuredContent))return response.structuredContent;
  for(const block of response.content||[]){
    if(block.type!=='text'||typeof block.text!=='string')continue;
    try{const parsed=JSON.parse(block.text);if(isObject(parsed)||Array.isArray(parsed))return parsed;}catch{}
  }
  return null;
}
function findReferences(value,depth=0){
  if(depth>5||value==null)return [];
  if(Array.isArray(value))return value.flatMap(x=>findReferences(x,depth+1));
  if(!isObject(value))return [];
  const link=sourceUrlForKage(value);
  const name=safeWord(value.name||value.title||value.design_name||value.product);
  const own=link&&name.length>=3?[{url:link,name,slug:link.split('/').pop()}]:[];
  for(const [key,v] of Object.entries(value)){
    if(['screenshots','images','prompt','components','metadata','taxonomy','description'].includes(key))continue;
    if(Array.isArray(v)||isObject(v))own.push(...findReferences(v,depth+1));
  }
  return own;
}
function extractPrompt(v,depth=0){
  if(depth>4||v==null)return null;
  if(Array.isArray(v))return v.map(x=>extractPrompt(x,depth+1)).find(Boolean)||null;
  if(!isObject(v))return null;
  for(const key of ['prompt','designPrompt','design_prompt','readyToPastePrompt','promptText','prompt_text','fullPrompt']){
    const candidate=v[key];
    if(typeof candidate==='string'&&candidate.trim().length>=70&&Buffer.byteLength(candidate,'utf8')<=MAX_PROMPT_BYTES)
      return candidate; // Exact text from publisher MCP, not a generated rewrite.
  }
  for(const key of ['design','data','result','payload']){
    const nested=extractPrompt(v[key],depth+1);
    if(nested)return nested;
  }
  return null;
}
export function verifiedKagePrompt(response,expectedUrl){
  const data=parseToolContent(response);
  if(!data)return null;
  const returned=sourceUrlForKage(data.design||data);
  if(returned&&returned!==expectedUrl)return null;
  const prompt=extractPrompt(data);
  if(!prompt)return null;
  return {text:prompt,sha256:crypto.createHash('sha256').update(prompt).digest('hex'),
    publisher:'Kage',sourceUrl:expectedUrl,origin:'kage.design/mcp:get_design'};
}
export async function findKageOriginals(brief,{transport=fetch,limit=3}={}){
  const client=createMcpClient({transport});
  const tools=await client.discoverTools();
  const search=tools.find(x=>x.name==='search_designs');
  const get=tools.find(x=>x.name==='get_design');
  if(!search||!get)throw Error('Kage source tools are not currently available');
  const args=toolArguments(search,'search',brief);
  if(!args)throw Error('Publisher search schema is unsupported');
  const result=await client.call('search_designs',args);
  const data=parseToolContent(result);
  if(!data)return {status:'no-structured-results',matches:[]};
  const references=[...new Map(findReferences(data).map(x=>[x.url,x])).values()].slice(0,Math.max(1,Math.min(limit,3)));
  const matches=[];
  for(const record of references){
    const getArgs=toolArguments(get,'get',record.slug);
    let original=null;
    if(getArgs){
      try{original=verifiedKagePrompt(await client.call('get_design',getArgs),record.url);}
      catch{/* Publisher failure never becomes a fabricated original prompt. */}
    }
    matches.push({url:record.url,title:record.name,publisher:'Kage',
      originalPrompt:original?.text||null,originalPromptStatus:original?'verified-publisher':'not-verified',
      originalPromptHash:original?.sha256||null,originalPromptOrigin:original?.origin||null});
  }
  return {status:matches.length?'ready':'no-matches',matches};
}
