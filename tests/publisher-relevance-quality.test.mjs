import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publisherEvidenceScore,isUnusablePublisherPage,rankPublisherEvidence,
  fallbackSubjectTerms
} from '../publisher-evidence-relevance.mjs';
import {
  shownSourceReferences,formatSourceDiscovery,formatSourceCombination
} from '../simple-discovery-chat.mjs';
import {clearScreenroveCacheForTests,searchScreenroveReferences}
  from '../screenrove-publisher.mjs';

const railway='Create an AI-powered digital lost-and-found system for large railway stations. '+
  'Passengers should report missing belongings with descriptions and photos, while station staff register found items. '+
  'The AI identifies possible matches, notifies users, guides identity verification, and coordinates safe item collection. '+
  'Include multilingual accessibility, real-time claim status, staff dashboards, and a public landing page.';
const source=(kind,name,path,summary)=>({
 id:path,name,site:'https://screenrove.com/'+path,
 provider:'Screenrove',publisherVerified:true,sourceKind:'inspiration',
 designType:kind,summary
});
const bad=[
  source('application-ui','Mermaid Chart — Not found page',
    'mermaid-chart/product/mermaid-chart-product-404',
    'Oops are you lost? Error page and documentation links'),
  source('application-ui','Mural — Home','mural/product/mural-product-home',
    'New mural split button, recent, starred templates, workspace switcher and rooms'),
  source('landing-page','Render — Homepage','render/marketing/render-marketing-home',
    'Cloud infrastructure production migration credits and developers'),
  source('landing-page','Jotform — AI Agents','jotform/marketing/jotform-marketing-ai-agents',
    'Customer service voice agents, WhatsApp, Instagram and chatbot'),
  {id:'kage-1',name:'Simha Digital — SEO workspace landing page',
    site:'https://kage.design/designs/simha-digital-landing-page',
    provider:'Kage',sourceKind:'inspiration',publisherVerified:true,
    originalPromptStatus:'verified-publisher',
    originalPrompt:'A long source-authorized landing prompt for organic SEO analytics '+
      'dashboards and a pricing feature table. It is a valid original source but is irrelevant to railway claims.'.repeat(2)}
];
const relevant=[
  source('application-ui','Railway lost item status tracking',
    'railway/product/passenger-lost-items',
    'Passenger reporting, missing property claims, station verification and collection'),
  source('landing-page','Lost property railway recovery service',
    'railway/marketing/lost-property-landing',
    'Railway passengers find missing belongings and report claims')
];
test('QA regression: real but irrelevant 404, generic workspace and unrelated marketing pages cannot pass',()=>{
  const shown=shownSourceReferences({
    applicationMatches:bad.slice(0,2),
    landingMatches:bad.slice(2)
  },{brief:railway});
  assert.deepEqual(shown,{applicationMatches:[],landingMatches:[]});
  assert.equal(isUnusablePublisherPage(bad[0],railway),true);
  assert.ok(bad.every(s=>publisherEvidenceScore(railway,s)===0),
    'Publisher authenticity alone must not be treated as relevance');
  const initial=formatSourceDiscovery({
    ...shown,screenroveStatus:'ready',discovery:{status:'partial'}
  },{brief:railway});
  assert.match(initial,/No sufficiently relevant original application or landing-page references/);
  assert.doesNotMatch(initial,/mermaid-chart|render-marketing-home|simha-digital/);
  const yes=formatSourceCombination({
    ...shown,componentMatches:[{provider:'React Bits',name:'Animated List',
      site:'https://reactbits.dev/components/animated-list',originalPrompt:null}]
  },{brief:railway});
  assert.match(yes,/reactbits.dev\/components\/animated-list/);
  assert.doesNotMatch(yes,/mermaid-chart|simha-digital/);
});
test('substantive publisher task evidence selects genuine relevant screens ahead of generic homepages',()=>{
  const shown=shownSourceReferences({
    applicationMatches:[bad[0],bad[1],relevant[0]],
    landingMatches:[bad[2],bad[3],bad[4],relevant[1]]
  },{brief:railway});
  assert.deepEqual(shown.applicationMatches.map(x=>x.name),[relevant[0].name]);
  assert.deepEqual(shown.landingMatches.map(x=>x.name),[relevant[1].name]);
  assert.ok(shown.applicationMatches[0].relevanceScore>0);
});
test('general-purpose evidence ranking handles multiple unfamiliar project types without a domain keyword registry',()=>{
  for(const [brief,match] of [
    ['Build a village seed exchange service where farmers trade surplus crops and book collection.',
      {name:'Farmers trade crops',summary:'Village seed exchange, collection booking and crop inventory'}],
    ['Create an archaeology archive for browsing excavation records and fragile ancient artifacts.',
      {name:'Archaeology excavation archive',summary:'Ancient artifact browsing and archaeological records'}],
    ['Design a wildfire volunteer dispatch system for rescue team shifts and emergency equipment.',
      {name:'Volunteer rescue dispatch',summary:'Emergency shifts and equipment coordination'}],
    ['Plan an urban smog mitigation platform for tracking pollution and daily sustainable routines.',
      {name:'Urban smog pollution tracking',summary:'Pollution metrics and low-emission routine'}],
    ['Build a public tool-sharing community where people borrow equipment and arrange repairs.',
      {name:'Tool sharing repair community',summary:'Borrow repair equipment from nearby members'}],
  ]){
    assert.ok(publisherEvidenceScore(brief,match)>0,match.name);
    assert.equal(rankPublisherEvidence(brief,[bad[1],match],{limit:2})[0].name,match.name);
    assert.ok(fallbackSubjectTerms(brief).length>0);
  }
});
test('official Screenrove search considers evidence among later hits instead of returning first ranked 404',async()=>{
  clearScreenroveCacheForTests();
  const found=new Map();
  const transport=async(url,options)=>{
    assert.equal(url,'https://screenrove.com/mcp');
    const req=JSON.parse(options.body);
    const respond=result=>new Response(JSON.stringify({jsonrpc:'2.0',id:req.id||1,result}),
      {status:200,headers:{'Content-Type':'application/json'}});
    if(req.method==='initialize')return respond({protocolVersion:'2025-03-26',capabilities:{}});
    if(req.method==='notifications/initialized')return new Response('',{status:202});
    if(req.method==='tools/call'&&req.params.name==='search_screens'){
      const kind=req.params.arguments.kind;
      const entries=kind==='product'?
        [
          {id:'bad404',kind,title:'Not found page',notes:'Page does not exist'},
          {id:'generic',kind,title:'Generic dashboard',notes:'Create a board and template'},
          {id:'good',kind,title:'Railway lost item status tracking',
            notes:'Passenger reporting, missing property claims, station verification and collection'}
        ]:[{
          id:'landing',kind,title:'Lost property railway recovery service',
          notes:'Railway passengers find missing belongings and report claims'
        }];
      for(const entry of entries)found.set(entry.id,entry);
      return respond({structuredContent:{screens:entries}});
    }
    if(req.method==='tools/call'&&req.params.name==='get_screen'){
      const entry=found.get(req.params.arguments.screenId);
      assert.ok(entry);
      const kind=entry.kind;
      const suffix=kind==='product'?'product':'marketing';
      return respond({structuredContent:{screen:{
        id:entry.id,kind,url:'https://screenrove.com/railway/'+suffix+'/'+entry.id,
        title:entry.title,notes:entry.notes
      }}});
    }
    throw Error('Unexpected publisher request');
  };
  const out=await searchScreenroveReferences({
    appQuery:'lost item claim status',landingQuery:'railway missing property help',
    brief:railway
  },{transport,now:()=>222222,limitPerKind:2});
  assert.equal(out.status,'ready');
  assert.deepEqual(out.matches.map(x=>x.name),[
    'Railway lost item status tracking','Lost property railway recovery service'
  ]);
  assert.ok(out.matches.every(x=>x.site.startsWith('https://screenrove.com/railway/')));
});
test('error-page designs are not incorrectly rejected when explicitly requested',()=>{
  assert.equal(isUnusablePublisherPage(bad[0],'Design a clean 404 not found page for a web app'),false);
});
