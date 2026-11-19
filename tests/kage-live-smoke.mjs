import {createMcpClient,findKageOriginals,toolArguments} from '../kage-publisher.mjs';
const client=createMcpClient({timeoutMs:10000});
const tools=await client.discoverTools();
const relevant=tools.filter(t=>['search_designs','get_design'].includes(t.name));
console.log('OFFICIAL KAGE MCP TOOL SCHEMAS:',JSON.stringify(
  relevant.map(t=>({name:t.name,inputSchema:t.inputSchema}))));
if(relevant.length!==2)throw Error('Required original publisher tools are missing');
const search=relevant.find(t=>t.name==='search_designs');
const args=toolArguments(search,'search','developer landing page');
if(!args)throw Error('Search schema does not map to a safe request');
const response=await client.call('search_designs',args);
console.log('OFFICIAL KAGE MCP SEARCH ENVELOPE:',JSON.stringify({
  keys:Object.keys(response||{}),
  structuredKeys:Object.keys(response?.structuredContent||{}),
  contentTypes:(response?.content||[]).map(x=>x.type),
  textStarts:(response?.content||[]).filter(x=>x.type==='text')
    .map(x=>x.text?.slice(0,180))
}));
const result=await findKageOriginals('developer landing page',{limit:1});
console.log('PUBLISHER INTEGRATION TEST:',JSON.stringify({
  status:result.status,
  matches:result.matches.map(x=>({
    url:x.url,publisher:x.publisher,promptStatus:x.originalPromptStatus,
    promptBytes:Buffer.byteLength(x.originalPrompt||'','utf8'),
    hash:x.originalPromptHash
  }))
}));
if(result.matches.length!==1||result.matches[0].originalPromptStatus!=='verified-publisher')
  throw Error('Could not prove exact source link AND prompt from official Kage MCP');
