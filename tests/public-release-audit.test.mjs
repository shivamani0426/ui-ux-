import test from 'node:test';
import assert from 'node:assert/strict';
import {claimPublisherSearch,clearPublisherSearchBudgetForTests}
  from '../publisher-search-budget.mjs';
import {formatSourceDiscovery,formatSourceCombination,isAffirmative,isNegative,
  isAmbiguousConsent,isConsentReply} from '../simple-discovery-chat.mjs';

const brief='Create a school learning dashboard with attendance and assignment cards';
const original={name:'Student Learning Dashboard',provider:'Kage',
  site:'https://kage.design/designs/student-learning-dashboard',
  originalPromptStatus:'verified-publisher',
  originalPrompt:'Design a student education dashboard with clear attendance, grades, assignments, daily timetable, and accessible navigation for the learning experience.'};
const component={name:'Sidebar',provider:'Aceternity UI',
  site:'https://ui.aceternity.com/components/sidebar',
  originalPrompt:null,originalPromptStatus:'not-published'};

test('publisher search cap is per visitor, not globally exhausted by the 13th unique visitor',()=>{
  clearPublisherSearchBudgetForTests();
  for(let i=0;i<30;i++){
    assert.equal(claimPublisherSearch('visitor-A',{now:100000}).allowed,true);
  }
  const blocked=claimPublisherSearch('visitor-A',{now:100000});
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.scope,'visitor');
  assert.equal(blocked.retryAfterSeconds,3600);
  // A different user must not see another user's 12/hour quota.
  for(let i=0;i<15;i++)
    assert.equal(claimPublisherSearch('visitor-B',{now:100000}).allowed,true);
  assert.equal(claimPublisherSearch('visitor-A',{now:3700001}).allowed,true);
});
test('shared publisher budget is still bounded across abusive rotating identities',()=>{
  clearPublisherSearchBudgetForTests();
  for(let i=0;i<240;i++)
    assert.equal(claimPublisherSearch('guest-'+i,{now:100000}).allowed,true);
  const overflow=claimPublisherSearch('guest-241',{now:100000});
  assert.equal(overflow.allowed,false);
  assert.equal(overflow.scope,'publisher');
  assert.equal(overflow.retryAfterSeconds,3600);
  assert.equal(claimPublisherSearch('guest-241',{now:3700001}).allowed,true);
});
test('unavailable, rate-limited, and genuinely unmatched publisher states stay distinct',()=>{
  const limited=formatSourceDiscovery({matches:[],discovery:{status:'rate-limited'}},{brief});
  const outage=formatSourceDiscovery({matches:[],discovery:{status:'unavailable'}},{brief});
  const none=formatSourceDiscovery({matches:[],discovery:{status:'no-matches'}},{brief});
  assert.match(limited,/rate-limited/i);
  assert.match(outage,/publisher is currently unavailable/);
  assert.match(none,/No matching original application-design page/);
  assert.ok(new Set([limited,outage,none]).size===3);
  for(const reply of [limited,outage,none]){
    assert.match(reply,/matching original UI components/);
    assert.doesNotMatch(reply,/best combination of UI\/UX designs and components/);
  }
});
test('source-only result does not synthesize combination; Yes with both creates a separate labeled synthesis',()=>{
  const onlyComponent=formatSourceCombination({matches:[],componentMatches:[component]},{brief});
  assert.match(onlyComponent,/Sidebar/);
  assert.doesNotMatch(onlyComponent,/Frontline combined implementation prompt/);
  const both=formatSourceCombination({matches:[original],componentMatches:[component]},{brief});
  assert.match(both,/Frontline combined implementation prompt/);
  assert.match(both,/NOT an original publisher prompt/);
  assert.match(both,/Create a school learning dashboard/);
  assert.match(both,/Student Learning Dashboard \(Kage\)/);
  assert.match(both,/Sidebar \(Aceternity UI\)/);
  assert.match(both,/kage.design\/designs\/student-learning-dashboard/);
  assert.match(both,/ui.aceternity.com\/components\/sidebar/);
  assert.ok(!both.includes(original.originalPrompt),'Do not repeat and relabel verbatim prompts');
  const noComponents=formatSourceCombination({matches:[original],componentMatches:[]},{brief});
  assert.doesNotMatch(noComponents,/Frontline combined implementation prompt/);
});
test('clear punctuation-normalized Yes! stays consent; ambiguous acknowledgements do not',()=>{
  for(const yes of ['Yes','YES!','yes!!!','yes please','Yes, please!','yes.']){
    assert.equal(isAffirmative(yes),true,yes);
    assert.equal(isConsentReply(yes),true,yes);
  }
  for(const no of ['No','No!','No, thanks!','Not now.']){
    assert.equal(isNegative(no),true,no);
    assert.equal(isConsentReply(no),true,no);
  }
  for(const maybe of ['Sure','okay','yep','maybe']){
    assert.equal(isAmbiguousConsent(maybe),true,maybe);
    assert.equal(isAffirmative(maybe),false,maybe);
    assert.equal(isConsentReply(maybe),true,maybe);
  }
  assert.equal(isAffirmative('yes?'),false,'Questions are not clear consent');
  assert.equal(isConsentReply('Design another dashboard'),false);
});
