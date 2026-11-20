import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
import {clearReactBitsCacheForTests} from '../reactbits-official.mjs';
import {clearAceternityCacheForTests} from '../aceternity-official.mjs';

const brief='Design an AI chatbot workspace with a collapsible conversation sidebar, '+
  'interactive message input, animated AI responses, floating navigation, and interactive cards. '+
  'Find genuine UI/UX inspiration and matching original components with their publisher links.';

test('Chat API returns actual publisher component links only after explicit Yes',async()=>{
  clearReactBitsCacheForTests();
  clearAceternityCacheForTests();
  const previous=globalThis.fetch;
  const rbFlag=process.env.FRONTLINE_REACTBITS_TEST_MOCK;
  const acFlag=process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
  const originalAiKey=process.env.OPENROUTER_API_KEY;
  const originalAiProvider=process.env.AI_PRIMARY_PROVIDER;
  // Reproduce Render, which has a real AI key during npm postinstall tests.
  // The public browser/API integration tests must stay deterministic.
  process.env.OPENROUTER_API_KEY='test-dummy-key-not-for-network';
  process.env.AI_PRIMARY_PROVIDER='openrouter';
  process.env.FRONTLINE_REACTBITS_TEST_MOCK='1';
  process.env.FRONTLINE_ACETERNITY_TEST_MOCK='1';
  let unintendedAiCalls=0;

  const officialReactEntries=[
    'https://reactbits.dev/micro/prompt-bar',
    'https://reactbits.dev/text-animations/text-type',
    ...Array.from({length:24},(_,i)=>'https://reactbits.dev/text-animations/example-'+i)
  ];
  const sitemap='<urlset>'+officialReactEntries.map(site=>
    '<url><loc>'+site+'</loc></url>').join('')+'</urlset>';
  const names=['floating-dock','squiggly-text','canvas-text','text-generate-effect',
    'sidebar','floating-navbar','card-hover-effect','gooey-input',
    ...Array.from({length:19},(_,i)=>'neutral-example-'+i)];
  const catalogue={meta:{website:'https://ui.aceternity.com'},components:
    names.map(name=>({name,title:name.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),
      description:name==='text-generate-effect'?'Animated text response effect':
        name==='sidebar'?'A collapsible conversation sidebar':
        name==='floating-navbar'?'Floating navigation menu':
        name==='card-hover-effect'?'Hovering interactive cards':'A component',
      categories:['component'],
      documentationUrl:'https://ui.aceternity.com/components/'+name}))};
  globalThis.fetch=(url,options)=>{
    if(String(url).includes('openrouter.ai')){
      unintendedAiCalls++;
      throw Error('Test unexpectedly called external AI despite NODE_ENV=test');
    }
    if(String(url)==='https://reactbits.dev/sitemap.xml')
      return Promise.resolve(new Response(sitemap,{status:200,
        headers:{'Content-Type':'application/xml'}}));
    if(String(url)==='https://ui.aceternity.com/api/components')
      return Promise.resolve(new Response(JSON.stringify(catalogue),{status:200,
        headers:{'Content-Type':'application/json'}}));
    return previous(url,options);
  };
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const api=async(path,method='GET',body)=>{
    const response=await fetch(root+path,{
      method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined
    });
    cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
    return {status:response.status,data:await response.json()};
  };
  try{
    const project=await api('/api/projects','POST',{brief});
    assert.equal(project.status,201);
    const path='/api/projects/'+project.data.project.id+'/messages';
    const first=await api(path,'POST',{message:brief,styles:[],simpleDiscovery:true});
    assert.equal(first.status,200);
    assert.equal(first.data.messages.at(-1).flowStage,'offer-combination');
    assert.doesNotMatch(first.data.messages.at(-1).content,/reactbits.dev\/micro\/prompt-bar/);
    assert.doesNotMatch(first.data.messages.at(-1).content,/Matching components and animations/);

    const combined=await api(path,'POST',{message:'Yes',styles:[],simpleDiscovery:true});
    assert.equal(combined.status,200);
    assert.equal(combined.data.messages.at(-1).flowStage,'complete');
    const answer=combined.data.messages.at(-1).content;
    assert.match(answer,/reactbits.dev\/micro\/prompt-bar/);
    assert.match(answer,/ui.aceternity.com\/components\/sidebar/);
    assert.match(answer,/ui.aceternity.com\/components\/text-generate-effect/);
    assert.match(answer,/ui.aceternity.com\/components\/floating-navbar/);
    assert.match(answer,/ui.aceternity.com\/components\/card-hover-effect/);
    assert.doesNotMatch(answer,/squiggly-text|canvas-text/);
    assert.doesNotMatch(answer,/Original prompt: see publisher page \(too long/);
    assert.equal(unintendedAiCalls,0,'Production AI secrets must not affect test fixture matching');
  }finally{
    globalThis.fetch=previous;
    if(originalAiKey===undefined)delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY=originalAiKey;
    if(originalAiProvider===undefined)delete process.env.AI_PRIMARY_PROVIDER;
    else process.env.AI_PRIMARY_PROVIDER=originalAiProvider;
    if(rbFlag===undefined)delete process.env.FRONTLINE_REACTBITS_TEST_MOCK;
    else process.env.FRONTLINE_REACTBITS_TEST_MOCK=rbFlag;
    if(acFlag===undefined)delete process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
    else process.env.FRONTLINE_ACETERNITY_TEST_MOCK=acFlag;
    await new Promise(resolve=>server.close(resolve));
  }
});
