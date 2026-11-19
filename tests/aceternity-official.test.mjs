import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAceternityComponentUrl,parseAceternityOfficialCatalogue,
  rankAceternityOriginals,findAceternityOriginalComponents,
  clearAceternityCacheForTests} from '../aceternity-official.mjs';

const names=['spotlight','background-beams','animated-tooltip','3d-card',
  'bento-grid','hero-highlight','floating-navbar','card-hover-effect',
  'infinite-moving-cards','sparkles','text-reveal-card','tracing-beam',
  'glowing-stars','moving-border','parallax-scroll','aurora-background',
  'direction-aware-hover','animated-modal','canvas-reveal-effect',
  'meteor-card','hero-parallax','globe','flip-words','card-stack','timeline',
  'gradient-box','scroll-reveal'];
const doc={
  meta:{website:'https://ui.aceternity.com'},
  components:[
    ...names.map(name=>({
      name,title:name.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),
      description:name.includes('spotlight')?
        'Spotlight effect for a glowing hero section with hover motion':
        name.includes('navbar')?'Responsive floating navigation animation':
          'An animated interface component for modern UI layouts',
      documentationUrl:'https://ui.aceternity.com/components/'+name,
      categories:['hero','animation']
    })),
    {name:'malicious-link',title:'Malicious',description:'A card',
      documentationUrl:'https://ui.aceternity.com.bad.invalid/components/malicious-link'},
    {name:'valid-slug',title:'Mixed source',description:'A card',
      documentationUrl:'https://ui.aceternity.com/components/wrong-slug'},
    {name:'broken',title:'JavaScript code',description:'A card',documentationUrl:'javascript:alert(1)'}
  ]
};
test('Official Aceternity JSON catalogue accepts only matching first-party component paths',()=>{
  const items=parseAceternityOfficialCatalogue(doc);
  assert.equal(items.length,names.length);
  assert.ok(items.some(x=>x.site==='https://ui.aceternity.com/components/spotlight'));
  assert.ok(!items.some(x=>x.name==='Malicious'||x.name==='Mixed source'));
  assert.equal(validateAceternityComponentUrl('https://ui.aceternity.com/components/spotlight','spotlight'),
    'https://ui.aceternity.com/components/spotlight');
  for(const url of ['https://ui.aceternity.com.evil.test/components/spotlight',
      'http://ui.aceternity.com/components/spotlight',
      'https://ui.aceternity.com/components/spotlight?preview=1',
      'https://ui.aceternity.com/components/different',
      'https://ui.aceternity.com/components/spotlight/']){
    assert.equal(validateAceternityComponentUrl(url,'spotlight'),null,url);
  }
});
test('Problem-statement relevance ranks original sources; no prompt is ever invented',()=>{
  const items=parseAceternityOfficialCatalogue(doc);
  const results=rankAceternityOriginals('Build a glowing hero spotlight effect',items);
  assert.equal(results[0].site,'https://ui.aceternity.com/components/spotlight');
  assert.ok(results.every(x=>x.provider==='Aceternity UI'&&x.sourceKind==='animation'));
  assert.ok(results.every(x=>x.originalPrompt===null&&x.originalPromptStatus==='not-published'));
  assert.ok(results.every(x=>x.provenance.includes('official JSON API')));
  assert.deepEqual(rankAceternityOriginals('astrobiology',items),[]);
});
test('Official component API fetch is bounded, cached and receives no user brief',async()=>{
  clearAceternityCacheForTests();
  let calls=0;
  const transport=async(url,opts)=>{
    calls++;
    assert.equal(url,'https://ui.aceternity.com/api/components');
    assert.equal(opts.method,'GET');
    assert.ok(!JSON.stringify(opts).includes('private-username@example.org'));
    return new Response(JSON.stringify(doc),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const first=await findAceternityOriginalComponents(
    'Create glowing spotlight hero private-username@example.org',{transport,now:()=>1500});
  const second=await findAceternityOriginalComponents(
    'Create glowing spotlight hero private-username@example.org',{transport,now:()=>1510});
  assert.equal(first.status,'ready');
  assert.equal(calls,1);
  assert.deepEqual(first,second);
  assert.ok(first.matches.every(x=>x.originalPrompt===null));
});
test('Malformed and unreachable official JSON index return zero fabricated sources',async()=>{
  clearAceternityCacheForTests();
  const fail=await findAceternityOriginalComponents('spotlight',{
    transport:async()=>new Response('denied',{status:403})});
  assert.equal(fail.status,'unavailable');
  assert.deepEqual(fail.matches,[]);
  clearAceternityCacheForTests();
  const invalid=await findAceternityOriginalComponents('spotlight',{
    transport:async()=>new Response(JSON.stringify({meta:{website:'https://another-site.invalid'},
      components:doc.components}),{status:200})});
  assert.equal(invalid.status,'unavailable');
  assert.deepEqual(invalid.matches,[]);
});
