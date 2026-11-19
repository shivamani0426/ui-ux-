// Controlled official-Kage-MCP protocol fixture used ONLY by tests.
const originalPrompt='Original Kage publisher prompt for the student dashboard. '+
  'Use a narrow sidebar, clear visual hierarchy, accessible contrast, responsive cards, '+
  'meaningful empty and error states, keyboard focus and a calm typography system. '+
  'This exact fixture string must be returned byte-for-byte; no Frontline rewrite.';
export {originalPrompt};
const respond=result=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}),{
  status:200,headers:{'Content-Type':'application/json'}});
export function mockKageFetch(url,options){
  if(url!=='https://kage.design/mcp')throw Error('Unexpected non-Kage publisher URL');
  const body=JSON.parse(options.body);
  if(body.method==='initialize')return Promise.resolve(respond({protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'kage',version:'1.0.0'}}));
  if(body.method==='notifications/initialized')return Promise.resolve(new Response('',{status:202}));
  if(body.method==='tools/list')return Promise.resolve(respond({tools:[
    {name:'search_designs',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer'}},required:['query']}},
    {name:'get_design',inputSchema:{type:'object',properties:{slug:{type:'string'}},required:['slug']}}
  ]}));
  if(body.method==='tools/call'&&body.params.name==='search_designs')
    return Promise.resolve(respond({content:[{type:'text',text:JSON.stringify({designs:[
      {slug:'student-dashboard-original',name:'Student dashboard original from Kage'}
    ]})}]}));
  if(body.method==='tools/call'&&body.params.name==='get_design'&&
    body.params.arguments.slug==='student-dashboard-original')
    return Promise.resolve(respond({structuredContent:{design:{
      slug:'student-dashboard-original',name:'Student dashboard original from Kage',
      prompt:originalPrompt
    }}}));
  throw Error('Unknown MCP call '+body.method);
}
export function installKageMock(){
  const previousFetch=globalThis.fetch;
  const previousFlag=process.env.FRONTLINE_KAGE_TEST_MOCK;
  process.env.FRONTLINE_KAGE_TEST_MOCK='1';
  globalThis.fetch=(url,options)=>{
    if(String(url)==='https://kage.design/mcp')return mockKageFetch(String(url),options);
    return previousFetch(url,options);
  };
  return ()=>{
    globalThis.fetch=previousFetch;
    if(previousFlag===undefined)delete process.env.FRONTLINE_KAGE_TEST_MOCK;
    else process.env.FRONTLINE_KAGE_TEST_MOCK=previousFlag;
  };
}
