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
  assert.match(after,/original design prompts/);
});
test('publisher unavailability is transparent rather than pretending React Bits was checked',()=>{
  const after=formatSourceCombination({
    matches:[],componentMatches:[ace[4]],
    componentDiscovery:{providers:[{provider:'React Bits',status:'unavailable'}]}
  },{brief});
  assert.match(after,/temporarily unavailable/);
  assert.match(after,/ui.aceternity.com\/components\/sidebar/);
});

test('exact user chatbot request rejects Kage App Store Screenshots, preserves genuine components',()=>{
  const brief='Design an AI chatbot workspace with a collapsible conversation sidebar, '+
    'interactive message input, animated AI responses, floating navigation, and interactive cards. '+
    'Find genuine UI/UX inspiration and matching original components with their publisher links.';
  const source={provider:'Kage',name:'App Store Screenshots',
    site:'https://kage.design/designs/app-store-screenshots',
    originalPrompt:null,originalPromptStatus:'not-verified'};
  const unrelated={provider:'Kage',name:'Retail Analytics Dashboard',
    site:'https://kage.design/designs/retail-analytics-dashboard',
    originalPrompt:null,originalPromptStatus:'not-verified'};
  const componentMatches=selectPublisherComponents(brief,react,ace,{limit:5});
  const sources={matches:[source,unrelated],componentMatches};
  assert.deepEqual(matchingPublisherDesigns(brief,sources.matches),[]);
  const first=formatSourceDiscovery(sources,{brief});
  assert.doesNotMatch(first,/App Store Screenshots|app-store-screenshots|Retail Analytics/);
  assert.match(first,/Would you like matching original UI components/);
  assert.doesNotMatch(first,/best combination of UI\/UX designs/);
  const second=formatSourceCombination(sources,{brief});
  assert.doesNotMatch(second,/App Store Screenshots|app-store-screenshots|Retail Analytics/);
  assert.doesNotMatch(second,/Frontline combined implementation prompt/);
  assert.match(second,/reactbits.dev\/micro\/prompt-bar/);
  assert.match(second,/ui.aceternity.com\/components\/sidebar/);
});
test('only a relevant publisher design can become a source of a combined implementation prompt',()=>{
  const brief='Design an AI chatbot workspace with a conversation sidebar and interactive message input.';
  const designs=[
    {provider:'Kage',name:'App Store Screenshots',site:'https://kage.design/designs/app-store-screenshots',
     originalPrompt:null,originalPromptStatus:'not-verified'},
    {provider:'Kage',name:'AI Chat Workspace',site:'https://kage.design/designs/ai-chat-workspace',
     originalPrompt:null,originalPromptStatus:'not-verified'}
  ];
  const result=matchingPublisherDesigns(brief,designs);
  assert.deepEqual(result.map(x=>x.name),['AI Chat Workspace']);
  const output=formatSourceCombination({matches:designs,componentMatches:[react[0]]},{brief});
  assert.match(output,/Frontline combined implementation prompt/);
  assert.match(output,/kage.design\/designs\/ai-chat-workspace/);
  assert.doesNotMatch(output,/App Store Screenshots/);
  assert.ok(output.includes('\n\n**Frontline combined implementation prompt'));
  assert.ok(!output.includes('\\n\\n'),'Combined prompt should contain real newlines, never literal backslash-n sequences');
});
