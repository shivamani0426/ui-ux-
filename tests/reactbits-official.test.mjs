import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReactBitsPublisherCatalogue,rankReactBitsOriginalComponents,
  findReactBitsOriginalComponents,clearReactBitsCacheForTests} from '../reactbits-official.mjs';
const sample=[
 '# React Bits','## Components',
 '- [Drift Wall](https://www.reactbits.dev/components/drift-wall): An endless perspective wall of tiles drifting past, lifting on hover. CLI: '+String.fromCharCode(96)+'DriftWall'+String.fromCharCode(96)+'.',
 '- [Dome Gallery](https://www.reactbits.dev/components/dome-gallery): Immersive 3D dome gallery projecting images on a hemispheric surface. CLI: '+String.fromCharCode(96)+'DomeGallery'+String.fromCharCode(96)+'.',
 '- [Unsafe](https://reactbits.dev.evil.invalid/components/fake): Fabricated gallery with no publisher link. CLI: '+String.fromCharCode(96)+'Unsafe'+String.fromCharCode(96)+'.',
 '- [Tracker](https://www.reactbits.dev/components/tracker?utm=trap): Invalid query parameters. CLI: '+String.fromCharCode(96)+'Tracker'+String.fromCharCode(96)+'.',
 '## Animations',
 '- [Click Spark](https://www.reactbits.dev/animations/click-spark): Creates particle spark bursts at click position. CLI: '+String.fromCharCode(96)+'ClickSpark'+String.fromCharCode(96)+'.',
 '## Backgrounds',
 '- [Galaxy](https://www.reactbits.dev/backgrounds/galaxy): Parallax starfield and interactive sky. CLI: '+String.fromCharCode(96)+'Galaxy'+String.fromCharCode(96)+'.',
 '## Text Animations',
 '- [Blur Text](https://www.reactbits.dev/text-animations/blur-text): Text starts blurred then crisply resolves. CLI: '+String.fromCharCode(96)+'BlurText'+String.fromCharCode(96)+'.',
 ...Array.from({length:22},(_,i)=>
  '- [Component '+i+'](https://www.reactbits.dev/text-animations/component-'+i+
  '): Text motion effect and animation. CLI: '+String.fromCharCode(96)+'Component'+i+String.fromCharCode(96)+'.')
].join('\n');
const sitemap='<urlset>'+[...sample.matchAll(/https:\/\/www\.reactbits\.dev\/(?:components|animations|backgrounds|text-animations)\/[a-z0-9-]+/g)]
  .map(x=>'<url><loc>'+x[0]+'</loc></url>').join('')+'</urlset>';
const respond=()=>new Response(sitemap,{status:200,headers:{'Content-Type':'application/xml'}});
test('Only exact official React Bits documentation URLs become source references',()=>{
  const items=parseReactBitsPublisherCatalogue(sample);
  assert.equal(items.length,27);
  assert.ok(items.some(x=>x.site==='https://www.reactbits.dev/components/drift-wall'));
  assert.ok(!items.some(x=>x.name==='Unsafe'||x.name==='Tracker'));
  assert.equal(items.find(x=>x.name==='Drift Wall').componentName,'DriftWall');
});
test('Match actual published gallery and animation pages without invented prompts',()=>{
  const entries=parseReactBitsPublisherCatalogue(sample);
  const result=rankReactBitsOriginalComponents('Build an immersive 3D dome image gallery',entries);
  assert.equal(result[0].site,'https://www.reactbits.dev/components/dome-gallery');
  assert.ok(result.every(x=>x.originalPrompt===null));
  assert.ok(result.every(x=>x.originalPromptStatus==='not-published'));
  assert.ok(result.every(x=>x.provenance.includes('publisher')));
  assert.deepEqual(rankReactBitsOriginalComponents('Neurobiology',entries),[]);
});
test('Official catalogue fetch is bounded and cached, without copying component code',async()=>{
  clearReactBitsCacheForTests();
  let calls=0;
  const fetcher=async(url,options)=>{
    calls++;
    assert.equal(url,'https://reactbits.dev/sitemap.xml');
    assert.equal(options.method,'GET');
    return respond();
  };
  const first=await findReactBitsOriginalComponents('3D dome gallery',{transport:fetcher,now:()=>100});
  const second=await findReactBitsOriginalComponents('3D dome gallery',{transport:fetcher,now:()=>110});
  assert.equal(first.status,'ready');
  assert.deepEqual(first,second);
  assert.equal(calls,1);
  assert.ok(!JSON.stringify(first).includes('files:'));
});
test('Unreachable or bogus publisher index gives no fabricated recommendations',async()=>{
  clearReactBitsCacheForTests();
  const unavailable=await findReactBitsOriginalComponents('gallery',{
    transport:async()=>new Response('error',{status:503})});
  assert.equal(unavailable.status,'unavailable');
  assert.deepEqual(unavailable.matches,[]);
  clearReactBitsCacheForTests();
  const faked=await findReactBitsOriginalComponents('gallery',{
    transport:async()=>new Response('Totally unrelated',{status:200})});
  assert.equal(faked.status,'unavailable');
  assert.deepEqual(faked.matches,[]);
});
