import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePublisherSources,parsePublisherEvaluation,
  publisherCandidateCatalog,clearPublisherEvaluationCacheForTests
} from '../publisher-semantic-evaluation.mjs';
import {shownSourceReferences,formatSourceDiscovery,formatSourceCombination}
  from '../simple-discovery-chat.mjs';
import {snapshotPublisherReferences} from '../publisher-source-persistence.mjs';
import {parseSemanticSelections,matchPublishedComponents}
  from '../publisher-semantic-matcher.mjs';

const brief='Build a public heritage preservation application where curators inventory fragile artifacts, '+
  'schedule restoration appointments, monitor humidity readings, review historical changes, '+
  'and publish an accessible visitor guide with exhibition timelines.';
const sources=[
  {id:'app-1',provider:'Screenrove',publisherVerified:true,sourceKind:'inspiration',
    designType:'application-ui',name:'Conservation collection workflow',
    site:'https://screenrove.com/archives/product/conservation-flow',
    summary:'Inventory review, asset worklists and curator activity'},
  {id:'app-2',provider:'Screenrove',publisherVerified:true,sourceKind:'inspiration',
    designType:'application-ui',name:'Account preferences',
    site:'https://screenrove.com/archives/product/settings',
    summary:'Select language, timezone and notification preferences'},
  {id:'landing-1',provider:'Screenrove',publisherVerified:true,sourceKind:'inspiration',
    designType:'landing-page',name:'Exhibition visitor guide',
    site:'https://screenrove.com/archives/marketing/exhibit-visitors',
    summary:'Visitor tour previews, cultural exhibits and event information'},
  {id:'landing-2',provider:'Kage',publisherVerified:true,sourceKind:'inspiration',
    name:'Cloud subscription pricing',
    site:'https://kage.design/designs/cloud-pricing',
    summary:'Pricing comparison, paid tiers and billing',
    originalPromptStatus:'verified-publisher',originalPrompt:'Build a cloud pricing page for SaaS subscriptions'},
  {id:'app-3',provider:'Screenrove',publisherVerified:true,sourceKind:'inspiration',
    designType:'application-ui',name:'Not found page',
    site:'https://screenrove.com/archives/product/not-found-404',
    summary:'Error page, user requested URL unavailable'}
];
test('semantic AI can transfer workflows without matching industry keywords; no hardcoded categories',async()=>{
  clearPublisherEvaluationCacheForTests();
  const result=await evaluatePublisherSources(brief,sources,{
    model:async({brief:given,sourceCatalog})=>{
      assert.equal(given,brief);
      assert.match(sourceCatalog,/Conservation collection workflow/);
      assert.doesNotMatch(sourceCatalog,/https?:\/\//,'The model sees metadata, not generated URLs');
      return JSON.stringify({choices:[
        {index:0,fit:5,reason:'Its review worklists could organize curator restoration tasks and inventory decisions.'},
        {index:2,fit:4,reason:'The visitor-focused content sections could explain exhibits and encourage visits.'},
        {index:1,fit:1,reason:'Generic account settings do not cover restoration work.'},
        {index:3,fit:1,reason:'Pricing page is unrelated to cultural preservation.'}
      ]});
    }
  });
  assert.equal(result.status,'semantic-evaluated');
  assert.deepEqual(result.applicationMatches.map(x=>x.id),['app-1']);
  assert.deepEqual(result.landingMatches.map(x=>x.id),['landing-1']);
  assert.ok(result.applicationMatches[0].matchReason.length>30);
});
test('semantic judge may reject all sources; do not fill empty design slots with lexical lookalikes',async()=>{
  clearPublisherEvaluationCacheForTests();
  const out=await evaluatePublisherSources(brief,sources,{model:async()=>JSON.stringify({choices:[]})});
  assert.equal(out.status,'semantic-evaluated');
  assert.deepEqual(out.applicationMatches,[]);
  assert.deepEqual(out.landingMatches,[]);
});
test('AI never supplies arbitrary URLs, malformed indices, weak fits, or page errors',()=>{
  const out=parsePublisherEvaluation(JSON.stringify({choices:[
    {index:91,fit:5,reason:'This should not be considered as it is not returned from the publisher.'},
    {index:4,fit:5,reason:'An error page is not a working restoration experience for visitors.'},
    {index:1,fit:2,reason:'A generic account settings page is at most a secondary pattern.'},
    {index:0,fit:5,reason:'The reference supports a real inventory workflow and curator worklists.'},
    {index:0,fit:5,reason:'Duplicate of the previously selected record, must not be shown twice.'}
  ]}),sources,{brief});
  assert.deepEqual(out.applicationMatches.map(x=>x.id),['app-1']);
  assert.equal(out.landingMatches.length,0);
  assert.equal(parsePublisherEvaluation('this is not JSON',sources),null);
});
test('provider outage returns only conservative verified metadata results, never invented publishers',async()=>{
  clearPublisherEvaluationCacheForTests();
  const out=await evaluatePublisherSources(brief,sources,{model:async()=>{throw Error('provider-offline')}});
  assert.equal(out.status,'metadata-fallback');
  assert.ok([...out.applicationMatches,...out.landingMatches].every(x=>x.publisherVerified));
  assert.ok(![...out.applicationMatches,...out.landingMatches].some(x=>x.name==='Not found page'));
  assert.ok(![...out.applicationMatches,...out.landingMatches].some(x=>x.id==='landing-2'));
});
test('first response and Yes both preserve exact AI-approved publisher links and reasons',async()=>{
  clearPublisherEvaluationCacheForTests();
  const accepted=await evaluatePublisherSources(brief,sources,{
    model:async()=>JSON.stringify({choices:[
      {index:0,fit:5,reason:'Collection worklists match the curator inventory and task review workflow.'},
      {index:2,fit:4,reason:'Exhibition content sections support an accessible public visitor guide.'}
    ]})
  });
  const firstSources={...accepted,sourceQualityStatus:accepted.status};
  const shown=shownSourceReferences(firstSources,{brief});
  assert.deepEqual(shown.applicationMatches.map(x=>x.site),[sources[0].site]);
  assert.deepEqual(shown.landingMatches.map(x=>x.site),[sources[2].site]);
  const intro=formatSourceDiscovery(firstSources,{brief});
  assert.match(intro,/Why it may fit:/);
  assert.doesNotMatch(intro,/cloud-pricing|not-found-404|Account preferences/);
  const saved=snapshotPublisherReferences(shown);
  assert.equal(saved.applicationMatches[0].relevanceAccepted,true);
  assert.match(saved.landingMatches[0].matchReason,/visitor guide/);
  const yes=formatSourceCombination({...saved,componentMatches:[{
    provider:'React Bits',name:'Animated List',
    site:'https://reactbits.dev/components/animated-list',originalPrompt:null,
    matchReason:'Display restoration updates and collection event history.'
  }]},{brief});
  assert.match(yes,/conservation-flow/);
  assert.match(yes,/exhibit-visitors/);
  assert.match(yes,/Suggested purpose: Display restoration updates/);
  assert.doesNotMatch(yes,/cloud-pricing|not-found-404|Account preferences/);
});
test('component quality gate accepts functional purposes and honors an intentional empty AI decision',async()=>{
  const items=[{provider:'React Bits',name:'Animated List',
    site:'https://reactbits.dev/components/animated-list',originalPrompt:null},
    {provider:'React Bits',name:'Blur Text',
    site:'https://reactbits.dev/text-animations/blur-text',originalPrompt:null}];
  const described=parseSemanticSelections(JSON.stringify({choices:[
    {index:0,purpose:'Provide a chronological list of restoration events',utility:'functional'},
    {index:1,purpose:'Make decorative text flash on a homepage',utility:'decorative'}
  ]}),items);
  assert.deepEqual(described.map(x=>x.name),['Animated List']);
  const rejected=await matchPublishedComponents(brief,items,[],{model:async()=>JSON.stringify({choices:[]})});
  assert.equal(rejected.status,'semantic-rejected');
  assert.deepEqual(rejected.matches,[]);
});
