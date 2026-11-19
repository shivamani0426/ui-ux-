import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
import {clearReactBitsCacheForTests} from '../reactbits-official.mjs';

const tick=String.fromCharCode(96);
const docs=[
 '# React Bits','## Components',
 '- [Drift Wall](https://www.reactbits.dev/components/drift-wall): An endless perspective wall of image tiles drifting, lifting on hover. CLI: '+tick+'DriftWall'+tick+'.',
 '- [Dome Gallery](https://www.reactbits.dev/components/dome-gallery): A 3D dome gallery for image cards and immersive portfolios. CLI: '+tick+'DomeGallery'+tick+'.',
 '## Animations',
 ...Array.from({length:25},(_,i)=>
  '- [Effect '+i+'](https://www.reactbits.dev/animations/effect-'+i+
  '): A smooth animated effect and motion treatment for interactive visuals. CLI: '+tick+'Effect'+i+tick+'.')
].join('\n');
const sitemap='<urlset>'+[...docs.matchAll(/https:\/\/www\.reactbits\.dev\/(?:components|animations)\/[a-z0-9-]+/g)]
  .map(x=>'<url><loc>'+x[0]+'</loc></url>').join('')+'</urlset>';

test('Actual Frontline API finds original React Bits source, persists the link and isolates it per owner',async()=>{
  clearReactBitsCacheForTests();
  const previous=globalThis.fetch;
  const flag=process.env.FRONTLINE_REACTBITS_TEST_MOCK;
  process.env.FRONTLINE_REACTBITS_TEST_MOCK='1';
  globalThis.fetch=(url,options)=>{
    if(String(url)==='https://reactbits.dev/sitemap.xml')
      return Promise.resolve(new Response(sitemap,{status:200,headers:{'Content-Type':'application/xml'}}));
    return previous(url,options);
  };
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  const makeClient=()=>{
    let cookie='';
    return async(path,method='GET',body)=>{
      const r=await fetch(root+path,{method,headers:{
        ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})
      },body:body?JSON.stringify(body):undefined});
      cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
      return {status:r.status,data:await r.json()};
    };
  };
  const a=makeClient(),b=makeClient();
  try{
    const project=await a('/api/projects','POST',{brief:'Design an interactive image gallery using Drift Wall'});
    assert.equal(project.status,201);
    const id=project.data.project.id,path='/api/projects/'+id+'/inspirations';
    const discovered=await a(path);
    assert.equal(discovered.status,200);
    assert.deepEqual(discovered.data.matches,[],'Kage design prompts are separate from React Bits components');
    assert.equal(discovered.data.componentDiscovery.status,'ready');
    assert.ok(discovered.data.componentMatches.length>0);
    const wall=discovered.data.componentMatches.find(x=>x.name==='Drift Wall');
    assert.ok(wall);
    assert.equal(wall.site,'https://www.reactbits.dev/components/drift-wall');
    assert.equal(wall.originalPrompt,null);
    assert.equal(wall.originalPromptStatus,'not-published');
    assert.equal((await b(path)).status,404);
    const saved=await a(path,'PUT',{sourceId:wall.id,selected:true});
    assert.equal(saved.status,200);
    assert.ok(saved.data.selected.includes(wall.id));
    const board=await a('/api/projects/'+id+'/workspace');
    assert.equal(board.status,200);
    assert.ok(board.data.savedInspirations.some(x=>x.id===wall.id));
    assert.equal((await b(path,'PUT',{sourceId:wall.id,selected:true})).status,404);
    const removed=await a(path,'PUT',{sourceId:wall.id,selected:false});
    assert.equal(removed.status,200);
    assert.ok(!removed.data.selected.includes(wall.id));
    const fake=await a(path,'PUT',{sourceId:'live_invented_bad',selected:true});
    assert.equal(fake.status,404);
  }finally{
    globalThis.fetch=previous;
    if(flag===undefined)delete process.env.FRONTLINE_REACTBITS_TEST_MOCK;
    else process.env.FRONTLINE_REACTBITS_TEST_MOCK=flag;
    await new Promise(resolve=>server.close(resolve));
  }
});
