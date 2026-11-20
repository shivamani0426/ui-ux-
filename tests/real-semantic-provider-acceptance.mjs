/**
 * Live semantic suitability acceptance for the UNDEPLOYED branch.
 * Genuine Screenrove MCP records + actual OpenRouter response. No fabricated
 * publisher URLs and no user data. Only a free-routed model is accepted.
 * This is an opt-in release gate, never a default unit test.
 */
import {searchScreenroveReferences} from '../screenrove-publisher.mjs';
import {evaluatePublisherSources,publisherCandidateCatalog,clearPublisherEvaluationCacheForTests}
  from '../publisher-semantic-evaluation.mjs';
import {designAiReply} from '../ai-providers.mjs';

if(process.env.FRONTLINE_REAL_AI_ACCEPTANCE!=='1')
  throw Error('Release QA explicit opt-in required');
const token=process.env.OPENROUTER_API_KEY||'';
if(!token){
  console.error('REAL_AI_ACCEPTANCE FAILED live-ai-credential-not-connected-to-ci');
  process.exit(1);
}
// Default remains zero-cost. A non-free QA model requires an explicit
// repository Actions variable; never silently switch to a billable provider.
const qaModel=process.env.OPENROUTER_MODEL||'openrouter/free';
if(qaModel.length>100||!/^([a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.:-]+$/.test(qaModel))
  throw Error('Invalid explicitly configured QA OpenRouter model');
if(qaModel!=='openrouter/free'&&process.env.FRONTLINE_QA_PAID_MODEL_APPROVED!=='true')
  throw Error('Non-free QA model requires explicit approval flag');
const brief='Design a shared equipment booking and inspection application for public workshop administrators. '+
  'Members reserve available time slots, check booking calendars and view equipment status. '+
  'Staff maintain inventory records and track repair requests. The interface must be accessible.';
const found=await searchScreenroveReferences({
  appQuery:'booking calendar',appQueries:['inventory management'],brief
},{candidateMode:true,limitPerKind:5});
const items=(found.matches||[]).filter(x=>x.publisherVerified===true);
if(items.length===0){
  console.error('REAL_AI_ACCEPTANCE FAILED publisher-no-verified-screens');
  process.exit(1);
}
console.log('REAL_AI_ACCEPTANCE official-candidates='+items.length);
clearPublisherEvaluationCacheForTests();
let modelCalls=0,failedReason='';
const result=await evaluatePublisherSources(brief,items,{model:async({brief:goal,sourceCatalog})=>{
  modelCalls++;
  const failures=[];
  const answer=await designAiReply({brief:goal,sourceCatalog,task:'source-evaluate',
    messages:[],styles:[],onFailure:issue=>failures.push(issue.reason),
    env:{
      OPENROUTER_API_KEY:token,
      OPENROUTER_MODEL:qaModel,
      AI_PRIMARY_PROVIDER:'openrouter',
      AI_FALLBACK_ENABLED:'false',
      AI_REQUEST_TIMEOUT_MS:'30000'
    }
  });
  failedReason=failures[0]||'';
  return answer;
}});
const selected=[...result.applicationMatches,...result.landingMatches];
console.log('REAL_AI_ACCEPTANCE model-calls='+modelCalls+
  ' review-status='+result.status+' accepted='+selected.length+
  ' fallback-reason='+(failedReason||'none'));
if(result.status!=='semantic-evaluated'){
  console.error('REAL_AI_ACCEPTANCE FAILED actual-model-semantic-judgment-not-delivered');
  process.exitCode=1;
}else if(!selected.length){
  console.error('REAL_AI_ACCEPTANCE FAILED known-publisher-task-candidates-rejected-without-match');
  process.exitCode=1;
}else if(!selected.every(x=>x.publisherVerified===true&&x.matchReason?.length>=24)){
  console.error('REAL_AI_ACCEPTANCE FAILED semantic-selection-not-grounded-in-publisher-candidate');
  process.exitCode=1;
}else{
  console.log('REAL_AI_ACCEPTANCE PASSED live model selected grounded publisher candidates');
}
