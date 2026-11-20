import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
import {shownSourceReferences,formatSourceCombination} from '../simple-discovery-chat.mjs';
import {clearScreenroveCacheForTests} from '../screenrove-publisher.mjs';
import {clearReactBitsCacheForTests} from '../reactbits-official.mjs';

const brief='Create an AI-powered community tool-sharing and repair platform where people can '+
 'lend, borrow and repair equipment instead of purchasing new items. Users should upload '+
 'photos, find tools nearby, reserve for specific dates, schedule pickups, manage returns, '+
 'receive maintenance reminders, get AI safety guidance, and see money saved and '+ 
 'environmental benefits. Design experiences for borrowers, owners and administrators.';

const screen=(kind,name,slug)=>({
 id:slug,kind,title:name,productName:'Community',
 url:'https://screenrove.com/community/'+(kind==='product'?'product/':'marketing/')+slug,
 notes:'Community borrowing search, booking, pickup and tool care'
});
test('long combined prompt keeps the full requirements and uses matching first-page references',()=>{
  const long=brief+' '+('Explain borrower pickup and returns clearly. '.repeat(58))+
    'Keep maintenance reminders, savings metrics and environmental impact visible.';
  assert.ok(long.length>2300);
  const app={provider:'Screenrove',name:'Community — Tool Sharing Dashboard',
    site:'https://screenrove.com/community/product/community-tool-dashboard',
    designType:'application-ui',publisherVerified:true,originalPrompt:null};
  const land={provider:'Screenrove',name:'Community — Landing',
    site:'https://screenrove.com/community/marketing/community-landing',
    designType:'landing-page',publisherVerified:true,originalPrompt:null};
  const wrong={provider:'Screenrove',name:'Dribbble — Pro pricing',
    site:'https://screenrove.com/dribbble/marketing/dribbble-marketing-pricing',
    designType:'landing-page',publisherVerified:true,originalPrompt:null};
  const unrelated={provider:'Kage',name:'Mastra Factory — software delivery landing page',
    site:'https://kage.design/designs/mastra-factory-landing-page',
    originalPrompt:null,originalPromptStatus:'not-verified'};
  const sources={applicationMatches:[app],landingMatches:[wrong,land,unrelated],
    componentMatches:[{provider:'Aceternity UI',name:'File Upload',
      site:'https://ui.aceternity.com/components/file-upload',originalPrompt:null}]};
  const shown=shownSourceReferences(sources,{brief:long});
  assert.deepEqual(shown.applicationMatches.map(x=>x.name),[app.name]);
  assert.deepEqual(shown.landingMatches.map(x=>x.name),[land.name]);
  const answer=formatSourceCombination(sources,{brief:long});
  assert.match(answer,/environmental impact visible/);
  assert.match(answer,/borrower pickup and returns clearly/);
  assert.match(answer,/Community — Tool Sharing Dashboard/);
  assert.doesNotMatch(answer,/Dribbble — Pro pricing|Mastra Factory/);
  assert.ok(!answer.includes('receive mainte. Base'),'Previously cut at 310 characters');
  assert.ok(answer.length<16000);
});
test('long original brief survives project creation, chat submission, and Yes reuses the exact publisher URLs',async()=>{
  const originalFetch=globalThis.fetch;
  const oldFlags=[process.env.FRONTLINE_SCREENROVE_TEST_MOCK,
    process.env.FRONTLINE_REACTBITS_TEST_MOCK];
  process.env.FRONTLINE_SCREENROVE_TEST_MOCK='1';
  process.env.FRONTLINE_REACTBITS_TEST_MOCK='1';
  clearScreenroveCacheForTests();clearReactBitsCacheForTests();
  let searches=0;
  const urlById=new Map();
  const respond=(id,result)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),
    {status:200,headers:{'Content-Type':'application/json'}});
  globalThis.fetch=(url,options={})=>{
    const href=String(url);
    if(href==='https://screenrove.com/mcp'){
      const req=JSON.parse(options.body);
      if(req.method==='initialize')
        return Promise.resolve(respond(req.id,{protocolVersion:'2025-03-26',capabilities:{}}));
      if(req.method==='notifications/initialized')
        return Promise.resolve(new Response('',{status:202}));
      if(req.method==='tools/call'&&req.params.name==='search_screens'){
        searches++;
        const kind=req.params.arguments.kind;
        const entry=screen(kind,kind==='product'?'Borrower reservation dashboard':'Tool sharing homepage',
          kind==='product'?'tool-availability-dashboard':'tool-sharing-home');
        urlById.set(entry.id,entry);
        return Promise.resolve(respond(req.id,{structuredContent:{screens:[entry]}}));
      }
      if(req.method==='tools/call'&&req.params.name==='get_screen'){
        const entry=urlById.get(req.params.arguments.screenId);
        return Promise.resolve(respond(req.id,{structuredContent:{screen:entry}}));
      }
      throw Error('Unsupported publisher mock');
    }
    if(href==='https://reactbits.dev/sitemap.xml'){
      // The publisher adapter intentionally rejects implausibly tiny indexes.
      const urls=['https://reactbits.dev/micro/prompt-bar',
        ...Array.from({length:25},(_,i)=>'https://reactbits.dev/components/verified-demo-'+i)];
      const xml='<urlset>'+urls.map(x=>'<url><loc>'+x+'</loc></url>').join('')+'</urlset>';
      return Promise.resolve(new Response(xml,
        {status:200,headers:{'Content-Type':'application/xml'}}));
    }
    return originalFetch(url,options);
  };
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const api=async(path,method='GET',body)=>{
    const res=await fetch(host+path,{method,headers:{
      ...(cookie?{Cookie:cookie}:{}),
      ...(body?{'Content-Type':'application/json'}:{})
    },body:body?JSON.stringify(body):undefined});
    cookie=res.headers.get('set-cookie')?.split(';')[0]||cookie;
    return {status:res.status,data:await res.json()};
  };
  try{
    const long=brief+' '+('The system requires comprehensive loan history and maintenance guidance. '.repeat(37))+
      'Finish with a meaningful impact dashboard showing money saved and environmental benefits.';
    assert.ok(long.length>2500&&long.length<7000);
    const created=await api('/api/projects','POST',{brief:long});
    assert.equal(created.status,201,JSON.stringify(created.data));
    assert.equal(created.data.project.brief,long);
    const route='/api/projects/'+created.data.project.id+'/messages';
    const first=await api(route,'POST',{message:long,styles:[],simpleDiscovery:true});
    assert.equal(first.status,200,JSON.stringify(first.data));
    const offered=first.data.messages.at(-1);
    assert.match(offered.content,/screenrove.com\/community\/product\/tool-availability-dashboard/);
    assert.match(offered.content,/screenrove.com\/community\/marketing\/tool-sharing-home/);
    assert.equal(offered.flowStage,'offer-combination');
    assert.equal(offered.sourceSnapshot.applicationMatches.length,1);
    assert.equal(offered.sourceSnapshot.landingMatches.length,1);
    assert.equal(offered.sourceSnapshot.applicationMatches[0].category,'Original application UI');
    assert.equal(offered.sourceSnapshot.landingMatches[0].category,'Original landing page');
    const beforeSearches=searches;
    const yes=await api(route,'POST',{message:'Yes',styles:[],simpleDiscovery:true});
    assert.equal(yes.status,200,JSON.stringify(yes.data));
    assert.equal(searches,beforeSearches,'Yes must not re-run source search and change references');
    const answer=yes.data.messages.at(-1).content;
    assert.match(answer,/tool-availability-dashboard/);
    assert.match(answer,/tool-sharing-home/);
    assert.match(answer,/environmental benefits/);
    const saved=await api('/api/projects/'+created.data.project.id);
    assert.equal(saved.status,200);
    assert.equal(saved.data.project.brief,long);
  }finally{
    globalThis.fetch=originalFetch;
    [process.env.FRONTLINE_SCREENROVE_TEST_MOCK,
     process.env.FRONTLINE_REACTBITS_TEST_MOCK]=oldFlags;
    if(oldFlags[0]===undefined)delete process.env.FRONTLINE_SCREENROVE_TEST_MOCK;
    if(oldFlags[1]===undefined)delete process.env.FRONTLINE_REACTBITS_TEST_MOCK;
    await new Promise(resolve=>server.close(resolve));
  }
});
