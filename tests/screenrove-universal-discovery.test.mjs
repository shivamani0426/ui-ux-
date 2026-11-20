import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validScreenrovePage,verifiedScreenroveReference,searchScreenroveReferences,
  clearScreenroveCacheForTests
} from '../screenrove-publisher.mjs';
import {planSourceQueries,parseSourceQueries,fallbackSourceQueries}
  from '../publisher-source-query-plan.mjs';
import {trustedPublisherLink,formatSourceDiscovery,formatSourceCombination}
  from '../simple-discovery-chat.mjs';
import {designAiReply} from '../ai-providers.mjs';

const examples=[
  'Create a GenAI assistant helping families navigate severe winter smog and explain low-emission choices.',
  'Design a village seed-sharing marketplace where farmers exchange surplus produce.',
  'Make a volunteer disaster response application for coordinating rotating shifts and resources.',
  'Build a virtual museum research interface for browsing fragile archaeological collections.',
  'Design an industrial machine maintenance planner for factory technicians.'
];
const fakeTransport=async(url,options)=>{
  assert.equal(url,'https://screenrove.com/mcp');
  assert.equal(options.method,'POST');
  const request=JSON.parse(options.body);
  const method=request.method;
  const asJson=(result,headers={})=>new Response(JSON.stringify({
    jsonrpc:'2.0',id:request.id||1,result
  }),{status:200,headers:{'Content-Type':'application/json',...headers}});
  if(method==='notifications/initialized')return new Response('',{status:202});
  if(method==='initialize')return asJson({protocolVersion:'2025-03-26',capabilities:{tools:{}},
    serverInfo:{name:'screenrove',version:'1.9.0'}},{'Mcp-Session-Id':'session-abc'});
  if(method==='tools/call'){
    if(request.params.name==='search_screens'){
      const kind=request.params.arguments.kind;
      assert.ok(['product','marketing'].includes(kind));
      const list=kind==='product'?
        [{id:'observed-product',kind:'product',product:'Acme',
          title:'Activity analytics dashboard',notes:'Task cards and progress metrics'}]:
        [{id:'observed-marketing',kind:'marketing',product:'Acme',
          title:'Community volunteer welcome page',notes:'Community volunteer membership welcome benefits'}];
      return asJson({structuredContent:{total:1,screens:list}});
    }
    if(request.params.name==='get_screen'){
      const id=request.params.arguments.screenId;
      return asJson({structuredContent:{screen:{
        id,url:id==='observed-product'?'https://screenrove.com/dashboards/acme-product-home':
          'https://screenrove.com/landing-pages?open=acme-marketing-home',
        title:'An observed screen',capturedAt:'2026-11-10'
      }}});
    }
  }
  throw Error('unexpected publisher MCP call: '+method);
};

test('read-only official Screenrove MCP gives genuine application and landing URLs independently',async()=>{
  clearScreenroveCacheForTests();
  const result=await searchScreenroveReferences({
    appQuery:'activity analytics dashboard',
    landingQuery:'community volunteer service landing page'
  },{transport:fakeTransport,now:()=>100000});
  assert.equal(result.status,'ready');
  assert.equal(result.matches.length,2);
  assert.deepEqual(result.matches.map(x=>x.designType),['application-ui','landing-page']);
  assert.ok(result.matches.every(x=>x.originalPrompt===null&&x.publisherVerified===true));
  assert.ok(result.matches.every(x=>trustedPublisherLink(x)===x.site));
  assert.equal(result.matches[0].site,'https://screenrove.com/dashboards/acme-product-home');
  assert.equal(result.matches[1].site,'https://screenrove.com/landing-pages?open=acme-marketing-home');
  const again=await searchScreenroveReferences({
    appQuery:'activity analytics dashboard',landingQuery:'community service landing page'
  },{transport:async()=>{throw Error('cache should prevent extra source calls');},now:()=>100100});
  assert.deepEqual(again.matches,result.matches);
});
test('publisher URL and identity validation prevents invented links and unrelated screen details',()=>{
  for(const url of [
    'https://screenrove.com.evil.test/dashboards/fake','http://screenrove.com/dashboards/fake',
    'https://screenrove.com/api/private','https://screenrove.com/',
    'https://screenrove.com/landing-pages?password=x','javascript:alert(1)'
  ]){
    assert.equal(validScreenrovePage(url),null,url);
  }
  assert.equal(verifiedScreenroveReference({id:'original',kind:'product',title:'Some Dashboard'},
    {id:'unrelated',pageUrl:'https://screenrove.com/dashboards/fake'},'product'),null);
  assert.equal(verifiedScreenroveReference({id:'x',kind:'marketing',title:'Sales'},
    {id:'x',pageUrl:'https://screenrove.com/dashboards/fake'},'product'),null);
  assert.equal(trustedPublisherLink({provider:'Screenrove',
    site:'https://screenrove.com/dashboards/proven',
    publisherVerified:false}),null);
});
test('unseen projects use general-purpose model query planning, not memorized prompt categories',async()=>{
  for(const brief of examples){
    let seen=0;
    const planned=await planSourceQueries(brief,{model:async text=>{
      seen++;
      assert.equal(text,brief);
      return JSON.stringify({
        application:'primary workflow dashboard with input and clear progress',
        landing:'benefits and features landing page for a service'
      });
    }});
    assert.equal(seen,1);
    assert.equal(planned.status,'ai-queries');
    assert.match(planned.appQuery,/workflow dashboard/);
    assert.match(planned.landingQuery,/features landing page/);
  }
  assert.equal(parseSourceQueries('{"application":"task dashboard","landing":"benefit page"}').status,'ai-queries');
  assert.equal(parseSourceQueries('{"application":"https://evil.com","landing":null}'),null);
  assert.equal(fallbackSourceQueries(examples[0]).status,'subject-query-fallback');
  assert.match(fallbackSourceQueries(examples[0]).appQuery,/smog/);
  assert.doesNotMatch(fallbackSourceQueries(examples[0]).appQuery,/overview dashboard/);
});
test('publisher references shown in separate application and landing sections; components are opt-in',()=>{
  const sources=[
    {provider:'Screenrove',name:'Urban smog air quality dashboard',
      site:'https://screenrove.com/dashboards/acme-product-home',publisherVerified:true,
      sourceKind:'inspiration',designType:'application-ui',summary:'Smog levels and air pollution metrics'},
    {provider:'Screenrove',name:'Winter smog family guide landing page',
      site:'https://screenrove.com/landing-pages?open=acme-marketing-home',publisherVerified:true,
      sourceKind:'inspiration',designType:'landing-page',summary:'Smog advice for families and communities'}
  ];
  const screen={applicationMatches:[sources[0]],landingMatches:[sources[1]],
    matches:sources,screenroveStatus:'ready',
    componentMatches:[{provider:'React Bits',name:'Prompt Bar',
      site:'https://reactbits.dev/micro/prompt-bar',originalPrompt:null}]};
  const initial=formatSourceDiscovery(screen,{brief:examples[0]});
  assert.match(initial,/Application UI references/);
  assert.match(initial,/Landing-page references/);
  assert.match(initial,/screenrove.com\/dashboards\/acme-product-home/);
  assert.match(initial,/landing-pages\?open=acme-marketing-home/);
  assert.doesNotMatch(initial,/reactbits.dev\/micro/,'Must not reveal components without explicit Yes');
  assert.match(initial,/Reply \*\*Yes\*\* or \*\*No\*\*/);
  const approved=formatSourceCombination(screen,{brief:examples[0]});
  assert.match(approved,/reactbits.dev\/micro\/prompt-bar/);
  assert.match(approved,/screenrove.com\/dashboards\/acme-product-home/);
  assert.doesNotMatch(approved,/Screenrove original publisher prompt \(verbatim\)/);
  assert.match(approved,/NOT an original publisher prompt/);
});
test('no actual publisher references returns clear honest absence, not a hardcoded website',()=>{
  const empty=formatSourceDiscovery({applicationMatches:[],landingMatches:[],
    screenroveStatus:'no-matches',discovery:{status:'no-matches'}},{brief:examples[0]});
  assert.match(empty,/No sufficiently relevant original application or landing-page references/);
  assert.match(empty,/Would you like matching original UI components/);
  assert.doesNotMatch(empty,/App Store Screenshots/);
});
test('existing AI source planner accepts unfamiliar briefs with structured JSON only',async()=>{
  let calls=0;
  const result=await designAiReply({
    brief:examples[4],task:'source-query',messages:[],
    env:{OPENROUTER_API_KEY:'test-key',AI_PRIMARY_PROVIDER:'openrouter',OPENROUTER_MODEL:'openrouter/free'},
    request:async(url,options)=>{
      calls++;assert.match(url,/openrouter.ai\/api\/v1/);
      const body=JSON.parse(options.body);
      assert.match(body.messages[0].content,/TWO short searches/);
      assert.match(body.messages[1].content,/industrial machine maintenance/);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{
        content:'{"application":"equipment maintenance dashboard", "landing":"factory automation benefits landing page"}'
      }}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  });
  assert.equal(calls,1);
  assert.match(result.text,/equipment maintenance dashboard/);
});

test('live publisher MCP compatibility on CI: actual Screenrove search and exact source URL', {
  skip:process.env.FRONTLINE_LIVE_SCREENROVE_CHECK!=='1'
},async()=>{
  const {createScreenroveClient,screenroveToolData}=await import('../screenrove-publisher.mjs');
  const client=createScreenroveClient({timeoutMs:12000});
  await client.initialize();
  const search=screenroveToolData(await client.call('search_screens',{
    q:'dashboard',kind:'product',limit:2,images:0
  }));
  console.log('SCREENROVE_LIVE_SEARCH_KEYS',Object.keys(search||{}));
  console.log('SCREENROVE_LIVE_SEARCH_SAMPLE',JSON.stringify(search).slice(0,950));
  const results=search?.screens||search?.data?.screens||search?.results||[];
  assert.ok(results.length>0,'Official publisher should return screen entries');
  const detail=screenroveToolData(await client.call('get_screen',{screenId:results[0].id}));
  console.log('SCREENROVE_LIVE_DETAIL_KEYS',Object.keys(detail||{}));
  console.log('SCREENROVE_LIVE_DETAIL_SAMPLE',JSON.stringify(detail).slice(0,1400));
});
