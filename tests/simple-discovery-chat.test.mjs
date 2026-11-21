import test from 'node:test';
import assert from 'node:assert/strict';
import {formatSourceDiscovery,formatSourceCombination,isAffirmative,
  isNegative,trustedPublisherLink} from '../simple-discovery-chat.mjs';

const original={provider:'Kage',name:'Learning Dashboard',site:'https://kage.design/designs/learning-dashboard',
  originalPromptStatus:'verified-publisher',originalPrompt:'Design a responsive school application with clear class navigation, accessible progress views and teacher controls.'};
const component={provider:'React Bits',name:'Prompt Bar',site:'https://reactbits.dev/micro/prompt-bar',
  originalPrompt:null,originalPromptStatus:'not-published'};
test('first response exposes exact publisher design and prompt but no components before consent',()=>{
  const text=formatSourceDiscovery({matches:[original],componentMatches:[component]});
  assert.match(text,/kage.design\/designs\/learning-dashboard/);
  assert.match(text,/Design a responsive school application/);
  assert.doesNotMatch(text,/reactbits.dev\/micro/);
  assert.match(text,/Reply \*\*Yes\*\* or \*\*No\*\*/);
});
test('yes gives exact design and official component links without invented component prompt',()=>{
  const text=formatSourceCombination({matches:[original],componentMatches:[component]});
  assert.match(text,/kage.design\/designs\/learning-dashboard/);
  assert.match(text,/reactbits.dev\/micro\/prompt-bar/);
  assert.match(text,/original design prompts/);
  assert.doesNotMatch(text,/responsive school application with clear class navigation/,'Do not repeat full original prompt after Yes');
});
test('reject spoofed links and do not make up sources',()=>{
  for(const site of ['https://kage.design.evil.com/designs/a',
    'https://kage.design/designs/a?fake=1','https://reactbits.dev/pricing',
    'http://ui.aceternity.com/components/3d-card']){
    assert.equal(trustedPublisherLink({...original,site}),null);
  }
  assert.match(formatSourceDiscovery({matches:[]}),/No matching original application-design page/);
});
test('consent is explicit; no ambiguous assent',()=>{
  assert.equal(isAffirmative('yes'),true);
  assert.equal(isAffirmative('yes please'),true);
  assert.equal(isAffirmative('design a school'),false);
  assert.equal(isNegative('no thanks'),true);
});

test('ambiguous replies cannot consent to fetching components',()=>{
  for(const message of ['sure','ok','okay','yep','combine them','Yes, and add some unrelated features']){
    assert.equal(isAffirmative(message),false,message);
  }
});
test('long publisher prompts remain exact or are clearly deferred to original page',()=>{
  const longText='Course and attendance dashboard with accessible navigation. '.repeat(100);
  const exact={...original,originalPrompt:longText};
  const first=formatSourceDiscovery({matches:[exact]});
  assert.ok(first.includes(longText),'Do not alter a supported verbatim publisher prompt');
  const tooLong={...original,originalPrompt:'X'.repeat(11000)};
  const response=formatSourceDiscovery({matches:[tooLong]});
  assert.doesNotMatch(response,/Original publisher prompt \(verbatim\)/);
  assert.match(response,/too long to display faithfully/);
  assert.match(response,/kage.design\/designs\/learning-dashboard/);
  assert.ok(response.length<16000,'Never exceed the renderer cap');
});
test('multiple long original prompts never silently overrun the chat renderer',()=>{
  const x={...original,originalPrompt:'Long original '.repeat(550)};
  const matches=[x,{...x,site:'https://kage.design/designs/another-learning-dashboard',name:'Another Dashboard'}];
  const result=formatSourceDiscovery({matches});
  assert.ok(result.length<16000);
  assert.match(result,/too long for this chat response/);
});

test('after consent, absent original designs do not produce an empty section or repeated list numbers',()=>{
  const onlyComponents=formatSourceCombination({
    matches:[],componentMatches:[component,{
      provider:'Aceternity UI',name:'Sidebar',
      site:'https://ui.aceternity.com/components/sidebar',
      originalPrompt:null,originalPromptStatus:'not-published'
    }]
  },{brief:'Design an AI chatbot workspace with conversation sidebar and prompt bar'});
  assert.match(onlyComponents,/^\*\*Matching components and animations\*\*/);
  assert.doesNotMatch(onlyComponents,/\*\*UI\/UX designs and original prompts\*\*/);
  assert.doesNotMatch(onlyComponents,/No verified matching original application designs/);
  assert.match(onlyComponents,/- \*\*Prompt Bar\*\*/);
  assert.match(onlyComponents,/- \*\*Sidebar\*\*/);
  assert.doesNotMatch(onlyComponents,/\n1\. \*\*Sidebar/);
  assert.match(onlyComponents,/reactbits.dev\/micro\/prompt-bar/);
  assert.match(onlyComponents,/ui.aceternity.com\/components\/sidebar/);
  assert.doesNotMatch(onlyComponents,/Frontline combined implementation prompt/);
});

test('Yes always returns an honest copyable original prompt when real AI rejects all publisher components',()=>{
  const brief='Create an equipment booking calendar and status workspace';
  const result=formatSourceCombination({matches:[original],componentMatches:[]},{brief});
  assert.match(result,/No verified matching components were found/);
  assert.match(result,/Frontline combined implementation prompt/);
  assert.match(result,/Design a cohesive interface for: Create an equipment booking calendar/);
  assert.match(result,/No matching original component was verified/);
  assert.match(result,/kage.design\/designs\/learning-dashboard/);
  assert.doesNotMatch(result,/reactbits.dev|ui.aceternity.com/);
  assert.doesNotMatch(result,/Original publisher prompt: Design a responsive school/);
});
