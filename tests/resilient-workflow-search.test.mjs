import test from 'node:test';
import assert from 'node:assert/strict';
import {reusableWorkflowQueries,planResilientPublisherQueries}
  from '../publisher-workflow-queries.mjs';
import {searchScreenroveReferences,clearScreenroveCacheForTests}
  from '../screenrove-publisher.mjs';
import {evaluatePublisherSources,clearPublisherEvaluationCacheForTests}
  from '../publisher-semantic-evaluation.mjs';

test('UI workflow search generalizes to unseen subjects without per-project recommendation lists',()=>{
  for(const [brief,first] of [
    ['Create a coastal ferry service with berth reservations and vessel repairs.','booking calendar'],
    ['Create a community archaeology archive of artifacts and equipment repair jobs.','inventory management'],
    ['Build a clinical document intake application with case review and approvals.','case management'],
    ['Create a wildfire dispatch system for task queues and staff assignments.','task board workflow'],
    ['Build a lake research monitoring dashboard showing sensor measurements and charts.','analytics dashboard'],
    ['Plan city bicycle routes with geographic map views and trip planning.','location map'],
    ['Design a team inbox for messages and notifications during incident response.','messaging notifications'],
    ['Build a photo upload portal for permit applications.','file upload form']
  ]){
    const found=reusableWorkflowQueries(brief);
    assert.ok(found.includes(first),brief);
    const planned=planResilientPublisherQueries(brief);
    assert.ok([planned.appQuery,...planned.appQueries].includes(first),brief);
    assert.ok(planned.appQueries.every(x=>x!==planned.appQuery));
    assert.ok(planned.landingQuery.length>10);
    assert.ok(planned.landingQueries.length>0);
    assert.ok(!JSON.stringify(planned).includes('screenrove.com'));
  }
});
test('unsupported domains still have broad genuine-source searches, never invented publisher links',()=>{
  const planned=planResilientPublisherQueries(
    'Invent a voice-controlled digital habitat for communicating with fictional nebula birds.');
  assert.ok(planned.appQuery.length>5);
  assert.ok(planned.landingQuery.length>5);
  assert.ok(!/https?:\/\//.test(JSON.stringify(planned)));
});
test('real first-party publisher response shape finds distinct task screens without source-query AI',async()=>{
  clearScreenroveCacheForTests();clearPublisherEvaluationCacheForTests();
  const brief='Build a shared equipment booking system with reservation slots, '+
    'calendar and asset maintenance for volunteer coordinators.';
  const queries=planResilientPublisherQueries(brief);
  assert.deepEqual([queries.appQuery,...queries.appQueries].sort(),[
    'booking calendar','inventory management'
  ].sort());
  const calls=[],details=new Map();
  const publisher=async(_url,options)=>{
    const req=JSON.parse(options.body);
    const response=x=>new Response(JSON.stringify({jsonrpc:'2.0',id:req.id||1,result:x}),
      {status:200,headers:{'Content-Type':'application/json'}});
    if(req.method==='initialize')return response({protocolVersion:'2025-03-26',capabilities:{}});
    if(req.method==='notifications/initialized')return new Response('',{status:202});
    if(req.method==='tools/call'&&req.params.name==='search_screens'){
      const {q,kind}=req.params.arguments;calls.push({q,kind});
      const entries=kind==='product'&&q==='booking calendar'?
        [{id:'cal',kind,title:'Calendar for booking slots',
          notes:'Users review reservation times, booking activity and schedule'}]:
        kind==='product'&&q==='inventory management'?
        [{id:'inventory',kind,title:'Inventory equipment management',
          notes:'Equipment status, asset records and maintenance checklists'}]:
        [];
      for(const entry of entries)details.set(entry.id,entry);
      return response({structuredContent:{screens:entries}});
    }
    if(req.method==='tools/call'&&req.params.name==='get_screen'){
      const e=details.get(req.params.arguments.screenId);
      if(!e)throw Error('publisher fixture unexpected ID');
      return response({structuredContent:{screen:{
        id:e.id,kind:e.kind,title:e.title,notes:e.notes,
        url:'https://screenrove.com/workflows/product/'+e.id
      }}});
    }
    throw Error('unexpected official publisher MCP method');
  };
  const found=await searchScreenroveReferences({...queries,brief},
    {transport:publisher,now:()=>123456,candidateMode:true,limitPerKind:6});
  assert.equal(found.status,'ready');
  assert.deepEqual(found.matches.map(x=>x.site).sort(),[
    'https://screenrove.com/workflows/product/cal',
    'https://screenrove.com/workflows/product/inventory'
  ].sort());
  assert.ok(calls.some(x=>x.q==='booking calendar'));
  assert.ok(calls.some(x=>x.q==='inventory management'));
  assert.ok(found.matches.every(x=>x.publisherVerified&&x.originalPrompt===null));
  const calendarIndex=found.matches.findIndex(x=>x.site.endsWith('/cal'));
  const inventoryIndex=found.matches.findIndex(x=>x.site.endsWith('/inventory'));
  const evaluated=await evaluatePublisherSources(brief,found.matches,{
    model:async()=>JSON.stringify({choices:[
      {index:calendarIndex,fit:5,reason:'The published calendar supports selecting and reviewing reservation slots.'},
      {index:inventoryIndex,fit:4,reason:'The published asset list supports keeping track of maintenance work.'}
    ]})
  });
  assert.equal(evaluated.status,'semantic-evaluated');
  assert.equal(evaluated.applicationMatches.length,2);
});
