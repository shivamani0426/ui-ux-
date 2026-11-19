import test from 'node:test';
import assert from 'node:assert/strict';
import {publisherComponentIntentBoost} from '../publisher-component-intent.mjs';
import {rankReactBitsOriginalComponents} from '../reactbits-official.mjs';
import {rankAceternityOriginals} from '../aceternity-official.mjs';
import {discoverLiveSources,clearDiscoveryCacheForTests} from '../live-source-discovery.mjs';
import {mockKageFetch} from './kage-mcp-fixture.mjs';

const brief='Design an AI chatbot workspace with a collapsible conversation sidebar, '+
  'interactive message input, animated AI responses, floating navigation, and interactive cards. '+
  'Find genuine UI/UX inspiration and matching original components with their publisher links.';
test('official React Bits message-input synonyms find actual Prompt Bar and typing source',()=>{
  const items=[
    {name:'Prompt Bar',site:'https://reactbits.dev/micro/prompt-bar',componentName:'prompt-bar',description:'',category:'micro'},
    {name:'Text Type',site:'https://reactbits.dev/text-animations/text-type',componentName:'text-type',description:'',category:'text-animations'},
    {name:'Shiny Text',site:'https://reactbits.dev/text-animations/shiny-text',componentName:'shiny-text',description:'',category:'text-animations'}
  ];
  const matches=rankReactBitsOriginalComponents(brief,items,{limit:5});
  assert.ok(matches.some(x=>x.name==='Prompt Bar'),'message input must match genuine Prompt Bar');
  assert.ok(matches.some(x=>x.name==='Text Type'),'animated AI replies must match real Text Type');
  assert.equal(matches[0].name,'Prompt Bar');
  assert.ok(matches.every(x=>x.originalPrompt===null&&x.site.startsWith('https://reactbits.dev/')));
  assert.equal(publisherComponentIntentBoost('Cakes and recipes','Prompt Bar'),0);
});
test('official Aceternity functional components outrank decorative text for chatbot requests',()=>{
  const names=['Gooey Input','Sidebar','Text Generate Effect','Floating Navbar','Card Hover Effect','Squiggly Text','Canvas Text'];
  const entries=names.map(name=>{
    const slug=name.toLowerCase().replaceAll(' ','-');
    return {site:'https://ui.aceternity.com/components/'+slug,
      name,slug,description:'A responsive animated component',categories:['animations']};
  });
  const matches=rankAceternityOriginals(brief,entries,{limit:7});
  const scores=Object.fromEntries(matches.map(x=>[x.name,x.relevanceScore]));
  assert.ok(scores.Sidebar>scores['Squiggly Text']);
  assert.ok(scores['Text Generate Effect']>scores['Squiggly Text']);
  assert.ok(scores['Card Hover Effect']>scores['Canvas Text']);
});
test('Kage retries official interior workspace search rather than presenting unrelated landing as a design',async()=>{
  clearDiscoveryCacheForTests();
  const searchQueries=[];
  const respond=result=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}),{
    status:200,headers:{'Content-Type':'application/json'}});
  const transport=(url,opts)=>{
    const body=JSON.parse(opts.body);
    if(body.method==='tools/call'&&body.params.name==='search_designs'){
      const query=String(body.params.arguments.query||'');
      searchQueries.push(query);
      const isTarget=query==='chat application workspace dashboard';
      return Promise.resolve(respond({content:[{type:'text',text:JSON.stringify({designs:[
        isTarget?{slug:'chat-workspace-original',name:'Chat Workspace Dashboard'}:
          {slug:'some-landing-original',name:'Some landing page'}
      ]})}]}));
    }
    if(body.method==='tools/call'&&body.params.name==='get_design'){
      const slug=body.params.arguments.slug;
      return Promise.resolve(respond({structuredContent:{design:{slug,
        prompt:'Original publisher text for this design, with a clear layout and accessible interface '.repeat(3)
      }}}));
    }
    return mockKageFetch(url,opts);
  };
  const result=await discoverLiveSources(brief,{transport,now:()=>123456,limit:3});
  assert.equal(result.status,'partial');
  assert.ok(searchQueries.length>=2);
  assert.ok(searchQueries.includes('chat application workspace dashboard'));
  const workspace=result.matches.find(x=>x.name==='Chat Workspace Dashboard');
  assert.ok(workspace,'second publisher search must surface genuine in-app designs if available');
  assert.equal(workspace.site,'https://kage.design/designs/chat-workspace-original');
  assert.equal(workspace.originalPromptStatus,'verified-publisher');
  assert.ok(result.matches.every(x=>x.site.startsWith('https://kage.design/designs/')));
});
