import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPublisherComponents} from '../published-component-selection.mjs';
import {formatSourceCombination,formatSourceDiscovery,matchingPublisherDesigns}
  from '../simple-discovery-chat.mjs';

const brief='Design an AI chatbot like ChatGPT with a collapsible conversation sidebar, '+
  'interactive prompt input bar, animated text responses, floating navigation, '+
  'interactive cards, dark mode and smooth transitions.';
const item=(provider,name,path,relevanceScore)=>({
  provider,name,componentName:path.split('/').pop(),site:
    (provider==='React Bits'?'https://reactbits.dev/':'https://ui.aceternity.com/')+path,
  relevanceScore,originalPrompt:null,originalPromptStatus:'not-published'
});
const react=[
  item('React Bits','Prompt Bar','micro/prompt-bar',10),
  item('React Bits','Shiny Text','text-animations/shiny-text',5),
  item('React Bits','Text Type','text-animations/text-type',5)
];
const ace=[
  item('Aceternity UI','Floating Dock','components/floating-dock',13),
  item('Aceternity UI','Squiggly Text','components/squiggly-text',12),
  item('Aceternity UI','Canvas Text','components/canvas-text',12),
  item('Aceternity UI','Text Generate Effect','components/text-generate-effect',10),
  item('Aceternity UI','Sidebar','components/sidebar',10),
  item('Aceternity UI','Floating Navbar','components/floating-navbar',9),
  item('Aceternity UI','Card Hover Effect','components/card-hover-effect',7)
];
test('chatbot functional components outrank decorative text matches despite higher base scores',()=>{
  const selected=selectPublisherComponents(brief,react,ace,{limit:5});
  assert.deepEqual(selected.map(x=>x.name),[
    'Prompt Bar','Sidebar','Text Generate Effect','Floating Navbar','Card Hover Effect'
  ]);
  assert.ok(selected.some(x=>x.provider==='React Bits'));
  assert.ok(selected.every(x=>x.originalPrompt==null));
  assert.ok(!selected.some(x=>['Squiggly Text','Canvas Text'].includes(x.name)));
});
test('no publisher entry means no invented direct link or inferred component',()=>{
  assert.deepEqual(selectPublisherComponents(brief,[],[],{limit:5}),[]);
  assert.deepEqual(selectPublisherComponents(brief,
    [item('React Bits','Shiny Text','text-animations/shiny-text',100)],[]),[]);
});
test('original design matching avoids presenting landing pages for chatbot workspace',()=>{
  const designs=[
    {provider:'Kage',name:'Audimate AI assistant landing page',site:'https://kage.design/designs/audimate-landing-page'},
    {provider:'Kage',name:'Harmony AI service management landing page',site:'https://kage.design/designs/harmony-landing-page'},
    {provider:'Kage',name:'Audimate',site:'https://kage.design/designs/audimate'},
    {provider:'Kage',name:'AI Chat Workspace',site:'https://kage.design/designs/ai-chat-workspace'}
  ];
  const matches=matchingPublisherDesigns(brief,designs);
  assert.deepEqual(matches.map(x=>x.name),['AI Chat Workspace']);
  const first=formatSourceDiscovery({matches:designs},{brief});
  assert.ok(first.includes('ai-chat-workspace'));
  assert.ok(!first.includes('audimate-landing-page'));
  assert.ok(!first.includes('harmony-landing-page'));
  assert.match(first,/Would you like the best combination/);
  assert.equal(matchingPublisherDesigns('Build an AI assistant landing page',designs).length,4);
});
test('after Yes show compact genuine publisher links, not two giant repeated design prompts',()=>{
  const prompt='An original Kage application design prompt. '.repeat(120);
  const sources={
    matches:[{provider:'Kage',name:'AI Chat Workspace',site:'https://kage.design/designs/ai-chat-workspace',
      originalPrompt:prompt,originalPromptStatus:'verified-publisher'}],
    componentMatches:selectPublisherComponents(brief,react,ace,{limit:5}),
    componentDiscovery:{providers:[{provider:'React Bits',status:'ready'}]}
  };
  const before=formatSourceDiscovery(sources,{brief});
  const after=formatSourceCombination(sources,{brief});
  assert.ok(before.includes(prompt));
  assert.ok(!after.includes(prompt));
  assert.ok(after.length<2500);
  assert.match(after,/Prompt Bar/);
  assert.match(after,/reactbits.dev\/micro\/prompt-bar/);
  assert.match(after,/ui.aceternity.com\/components\/sidebar/);
  assert.doesNotMatch(after,/Squiggly Text|Canvas Text|Original prompt: see publisher page \(too long/);
  assert.match(after,/original documentation links/);
});
test('publisher unavailability is transparent rather than pretending React Bits was checked',()=>{
  const after=formatSourceCombination({
    matches:[],componentMatches:[ace[4]],
    componentDiscovery:{providers:[{provider:'React Bits',status:'unavailable'}]}
  },{brief});
  assert.match(after,/temporarily unavailable/);
  assert.match(after,/ui.aceternity.com\/components\/sidebar/);
});
