import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPublishedComponents,parseSemanticSelections,
  verifiedComponentCatalog,fallbackPublisherComponents} from '../publisher-semantic-matcher.mjs';
import {designAiReply} from '../ai-providers.mjs';

const pollution='Create a GenAI-powered assistant that helps families and communities navigate '+
  'severe winter smog and urban air pollution. The application should suggest '+
  'low-emission daily routines, indoor air quality hacks, and sustainable alternatives '+
  'tailored to their location and lifestyle, while clearly explaining the direct impact of their choices.';
const item=(provider,name,path,summary='')=>({
  provider,name,site:(provider==='React Bits'?'https://reactbits.dev/':'https://ui.aceternity.com/')+path,
  componentName:path.split('/').pop(),summary,relevanceScore:0,originalPrompt:null,
  originalPromptStatus:'not-published'
});
const react=[
  item('React Bits','Count Up','text-animations/count-up'),
  item('React Bits','Animated List','components/animated-list'),
  item('React Bits','Prompt Bar','micro/prompt-bar'),
  item('React Bits','Text Type','text-animations/text-type')
];
const ace=[
  item('Aceternity UI','Input','components/input'),
  item('Aceternity UI','Timeline','components/timeline'),
  item('Aceternity UI','Bento Grid','components/bento-grid'),
  item('Aceternity UI','Text Generate Effect','components/text-generate-effect'),
  item('Aceternity UI','Sidebar','components/sidebar'),
  item('Aceternity UI','Stateful Button','components/stateful-button'),
  item('Aceternity UI','World Map','components/world-map'),
  item('Aceternity UI','Canvas Text','components/canvas-text')
];
test('unseen smog-assistant problem retrieves actual first-party components without training a smog prompt',async()=>{
  const match=await matchPublishedComponents(pollution,react,ace,{model:null});
  assert.ok(match.matches.length>=3,'Daily routines, impact and location have suitable general UI affordances');
  assert.ok(match.matches.some(x=>/Input/.test(x.name)));
  assert.ok(match.matches.some(x=>/Count Up/.test(x.name)));
  assert.ok(match.matches.some(x=>/Timeline|Animated List/.test(x.name)));
  assert.ok(!match.matches.some(x=>x.name==='Canvas Text'));
  assert.ok(match.matches.every(x=>x.site.startsWith('https://reactbits.dev/')||
    x.site.startsWith('https://ui.aceternity.com/')));
});
test('semantic model chooses from the WHOLE publisher catalogue, including zero-keyword entries',async()=>{
  const tasks=[
    {brief:'Make a disaster volunteer dispatch organizer with rotating shifts and incident responses',
      prefer:['Timeline','Stateful Button','Animated List']},
    {brief:'Plan sustainable cooking and grocery portions for an elderly household',
      prefer:['Input','Bento Grid','Count Up']},
    {brief:'Create an interactive archaeology exhibition guide for remote museum visitors',
      prefer:['World Map','Bento Grid','Text Generate Effect']},
    {brief:'Build a supply-chain repair ticket tracker with operator updates and completion checks',
      prefer:['Animated List','Stateful Button','Sidebar']}
  ];
  for(const {brief,prefer} of tasks){
    let invoked=0;
    const selected=await matchPublishedComponents(brief,react,ace,{
      model:async ({brief:sent,sourceCatalog})=>{
        invoked++;
        assert.equal(sent,brief);
        const candidates=verifiedComponentCatalog(react,ace);
        assert.equal(sourceCatalog.split('\n').length,candidates.length,
          'AI sees all publisher components, not 24 keyword-filtered guesses');
        return JSON.stringify({indices:prefer.map(name=>candidates.findIndex(x=>x.name===name))});
      }
    });
    assert.equal(invoked,1);
    assert.equal(selected.status,'semantic-ranked');
    assert.deepEqual(selected.matches.map(x=>x.name),prefer);
    assert.ok(selected.matches.every(x=>x.originalPrompt===null));
  }
});
test('invented links, bogus IDs and model markdown prose never pass as original components',async()=>{
  const hostile=item('Aceternity UI','Invented','components/fake');
  hostile.site='https://ui.aceternity.com.evil.test/components/fake';
  const catalog=verifiedComponentCatalog([...react,hostile],ace);
  assert.ok(!catalog.includes(hostile));
  assert.equal(parseSemanticSelections('{"indices":[999,0,-5,0,"1"]}',catalog).length,1);
  assert.equal(parseSemanticSelections('Use this new page: https://fake.example/',catalog),null);
  assert.deepEqual((await matchPublishedComponents('abstract workflow',[],[],{
    model:async()=>JSON.stringify({indices:[0]})
  })).matches,[]);
});
test('AI outage uses conservative generic affordances and does not assert zero publisher matches',async()=>{
  const result=await matchPublishedComponents(pollution,react,ace,{
    model:async()=>{throw new Error('model-down');}
  });
  assert.equal(result.status,'publisher-affordance-fallback');
  assert.ok(result.matches.length>=3);
  const notRelevant=await matchPublishedComponents('Create experimental poetry about feathers',
    [item('React Bits','Animated List','components/animated-list')],[],{model:async()=>null});
  assert.equal(notRelevant.matches.length,0);
});
test('configured OpenRouter receives natural-language brief and verified publisher catalog and returns only candidate indices',async()=>{
  let requests=0;
  const fakeRequest=async (url,options)=>{
    requests++;
    assert.match(String(url),/openrouter.ai\/api\/v1\/chat\/completions/);
    const body=JSON.parse(options.body);
    assert.match(body.messages[0].content,/arbitrary problem statement/);
    assert.match(body.messages[1].content,/severe winter smog/);
    assert.match(body.messages[1].content,/Bento Grid/);
    assert.match(body.messages[1].content,/Count Up/);
    assert.equal(body.messages[1].content.includes('PRIVATE_PASSWORD'),false);
    return new Response(JSON.stringify({choices:[{
      message:{content:'{"indices":[0,1]}'},finish_reason:'stop'
    }]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const result=await designAiReply({
    brief:pollution,sourceCatalog:'0|React Bits|Count Up|Count numbers\n1|Aceternity UI|Bento Grid|A grid of content',
    task:'component-match',messages:[],env:{
      OPENROUTER_API_KEY:'test-secret',AI_PRIMARY_PROVIDER:'openrouter',OPENROUTER_MODEL:'openrouter/free'
    },request:fakeRequest
  });
  assert.equal(requests,1);
  assert.equal(result.text,'{"indices":[0,1]}');
});
