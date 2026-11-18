/**
 * Milestone 07D deterministic synthetic evaluation.
 *
 * These are contract fixtures, NOT observations of real users and NOT
 * statistical precision, accessibility certification or AI-model training.
 * Run: npm run evaluate:learning
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {recommend} from './design-engine.mjs';
import {STYLES} from './design-engine.mjs';
import {normalizeProfile,learnFeedbackTransition,effectivePreferences} from './learning-engine.mjs';
import {derivePrivateLearning,contextForCategory,verifiedCohortBand} from './contextual-learning.mjs';

export const LEARNING_CASES=Object.freeze([
  {id:'education',brief:'Create an accessible education dashboard for students with assignments and progress tracking on low-power mobile devices',expected:'minimal'},
  {id:'health',brief:'Design a healthcare patient appointment dashboard with high accessibility, readable navigation and performance',expected:'minimal'},
  {id:'finance',brief:'Build a finance banking app for payments, budgeting and responsive low-end phones',expected:'minimal'},
  {id:'saas',brief:'Make a SaaS enterprise CRM with tasks, reports and fast performance',expected:'minimal'},
  {id:'commerce',brief:'Design an ecommerce shopping store with product catalog, checkout and orders',expected:'creative'},
  {id:'portfolio',brief:'Create a creative editorial portfolio for an illustrator featuring case studies',expected:'creative'},
  {id:'ai',brief:'Design a futuristic immersive 3D AI agent workspace with atmospheric depth',expected:'glass'},
  {id:'minimal',brief:'Make a simple clean website for a community group with clear pages',expected:'minimal'},
  {id:'creative',brief:'Build a bold playful landing experience for a creative studio',expected:'creative'},
]);
export function evaluateLearningEngine(){
  const checks=[];
  for(const fixture of LEARNING_CASES){
    const base=recommend(fixture.brief,{}),ranked=base.designs;
    checks.push({case:fixture.id,metric:'brief-first-ranking',passed:ranked[0]?.id===fixture.expected,
      observed:ranked[0]?.id,expected:fixture.expected});
    checks.push({case:fixture.id,metric:'all-three-directions',passed:
      ranked.length===3&&new Set(ranked.map(x=>x.id)).size===3});
    checks.push({case:fixture.id,metric:'scores-are-bounded',passed:
      ranked.every(x=>x.match>=48&&x.match<=96&&x.scoring.includes('Heuristic'))});
    for(const style of STYLES){
      const plus=recommend(fixture.brief,{styleWeights:{[style.id]:3}});
      const minus=recommend(fixture.brief,{styleWeights:{[style.id]:-3}});
      const b=ranked.find(x=>x.id===style.id),p=plus.designs.find(x=>x.id===style.id),m=minus.designs.find(x=>x.id===style.id);
      checks.push({case:fixture.id,metric:'feedback-direction-'+style.id,passed:
        p.match>=b.match&&m.match<=b.match&&p.match>=m.match&&
        p.personalization.appliedPointAdjustment===p.match-b.match&&
        m.personalization.appliedPointAdjustment===m.match-b.match});
    }
  }
  const example=normalizeProfile({});
  const afterLike=learnFeedbackTransition(example,'creative','like');
  const same=learnFeedbackTransition(afterLike,'creative','like','like');
  const reversed=learnFeedbackTransition(same,'creative','dislike','like');
  checks.push({case:'learning-state',metric:'idempotent-reaction',passed:
    afterLike.styleWeights.creative===1&&same.styleWeights.creative===1&&reversed.styleWeights.creative===-1});
  const paused=effectivePreferences({...afterLike,personalization:{enabled:false}});
  checks.push({case:'privacy',metric:'paused-learning-ignored',passed:
    Object.keys(paused.styleWeights).length===0});
  const mk=(id,category,reaction='like',style='creative')=>
    ({projectId:id,category,reaction,style});
  const sparse=derivePrivateLearning([mk('one','Portfolio')]);
  const consistent=derivePrivateLearning([mk('one','Portfolio'),mk('two','Portfolio'),
    mk('three','Portfolio'),mk('four','Portfolio')]);
  const contradictory=derivePrivateLearning([mk('one','Portfolio'),
    mk('two','Portfolio','dislike')]);
  const revised=derivePrivateLearning([mk('one','Portfolio','like','creative'),
    mk('one','Portfolio','dislike','creative'),mk('two','Portfolio')]);
  const neutral=contextForCategory(sparse,'Portfolio');
  const context=contextForCategory(consistent,'Portfolio');
  const pausedContext=contextForCategory(consistent,'Portfolio',false);
  const conflicting=contextForCategory(contradictory,'Portfolio');
  const revisedContext=contextForCategory(revised,'Portfolio');
  const cases=[
    ['one-project-not-enough',neutral.adjustments.creative===0],
    ['one-project-evidence-insufficient',neutral.evidence.creative?.confidence==='insufficient'],
    ['multiple-distinct-projects-adjust',context.adjustments.creative>0],
    ['support-count-is-projects',context.evidence.creative?.support===4],
    ['conservative-weight-cap',context.adjustments.creative<=3],
    ['no-portfolio-signal-on-healthcare',contextForCategory(consistent,'Healthcare').adjustments.creative===0],
    ['pausing-learning-removes-adjustment',pausedContext.adjustments.creative===0],
    ['contradictory-evidence-neutrals',conflicting.adjustments.creative===0],
    ['last-vote-reverses-earlier-like',revisedContext.evidence.creative?.dislikes===1],
    ['no-guest-public-trend',verifiedCohortBand(9)===null],
    ['verified-ten-account-minimum',verifiedCohortBand(10)==='10–24'],
    ['no-raw-identity-in-evidence',!JSON.stringify(context).includes('"projectId"')],
  ];
  for(const [metric,passed] of cases)checks.push({case:'context-v1',metric,passed});
  const basePortfolio=recommend('Create a creative illustrator portfolio with editorial case studies',{});
  const contextualPortfolio=recommend('Create a creative illustrator portfolio with editorial case studies',{
    ...effectivePreferences(normalizeProfile({})),contextLearning:context});
  const portfolioOld=basePortfolio.designs.find(x=>x.id==='creative').match;
  const portfolioNew=contextualPortfolio.designs.find(x=>x.id==='creative').match;
  checks.push({case:'context-v1',metric:'matching-context-does-not-demote-style',
    passed:portfolioNew>=portfolioOld});
  checks.push({case:'context-v1',metric:'scoring-remains-bounded',
    passed:contextualPortfolio.designs.every(x=>x.match>=48&&x.match<=96)});
  checks.push({case:'context-v1',metric:'score-factors-reconcile',passed:
    contextualPortfolio.designs.every(x=>x.match===
      Math.max(48,Math.min(96,x.scoreFactors.reduce((sum,f)=>sum+f.points,0))))});
  const passed=checks.filter(x=>x.passed).length;
  return {evaluation:'Synthetic deterministic contract tests; NOT real-world usability, statistical accuracy or trained-model evaluation',
    fixtureCount:LEARNING_CASES.length,contextualCheckCount:15,
    checkCount:checks.length,passed,failed:checks.length-passed,
    failures:checks.filter(x=>!x.passed)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=evaluateLearningEngine();
  console.log(JSON.stringify(report,null,2));
  if(report.failed)process.exitCode=1;
}
