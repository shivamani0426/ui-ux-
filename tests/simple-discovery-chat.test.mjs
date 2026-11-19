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
  assert.match(text,/not available or not verified/);
});
test('reject spoofed links and do not make up sources',()=>{
  for(const site of ['https://kage.design.evil.com/designs/a',
    'https://kage.design/designs/a?fake=1','https://reactbits.dev/pricing',
    'http://ui.aceternity.com/components/3d-card']){
    assert.equal(trustedPublisherLink({...original,site}),null);
  }
  assert.match(formatSourceDiscovery({matches:[]}),/No verified original design/);
});
test('consent is explicit; no ambiguous assent',()=>{
  assert.equal(isAffirmative('yes'),true);
  assert.equal(isAffirmative('yes please'),true);
  assert.equal(isAffirmative('design a school'),false);
  assert.equal(isNegative('no thanks'),true);
});
