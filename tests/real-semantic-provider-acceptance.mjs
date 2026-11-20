/**
 * Live semantic suitability acceptance for the UNDEPLOYED branch.
 * Genuine Screenrove MCP records + actual selected Groq or NVIDIA response. No fabricated
 * publisher URLs and no user data. Evaluation is never a unit-test mock.
 * This is an opt-in release gate, never a default unit test.
 */
import {searchScreenroveReferences} from '../screenrove-publisher.mjs';
import {evaluatePublisherSources,publisherCandidateCatalog,clearPublisherEvaluationCacheForTests}
  from '../publisher-semantic-evaluation.mjs';
import {designAiReply} from '../ai-providers.mjs';

if(process.env.FRONTLINE_REAL_AI_ACCEPTANCE!=='1')
  throw Error('Release QA explicit opt-in required');
const provider=process.env.FRONTLINE_TEST_PROVIDER==='groq'?'groq':'nvidia';
const token=provider==='groq'?process.env.GROQ_API_KEY||'':process.env.NVIDIA_API_KEY||'';
if(!token){
  console.error('REAL_AI_ACCEPTANCE FAILED '+provider+'-key-not-connected-to-ci');
  process.exit(1);
}
// Only the explicitly selected provider's known model is accepted; no bills
// or cross-provider requests may be triggered by a test.
const qaModel=provider==='groq'?'openai/gpt-oss-20b':'nvidia/nemotron-3.5-lightning-30b-a3b';
if(provider==='groq'&&process.env.GROQ_MODEL&&process.env.GROQ_MODEL!==qaModel)
  throw Error('Unexpected Groq QA model');
if(provider==='nvidia'&&process.env.NVIDIA_MODEL&&process.env.NVIDIA_MODEL!==qaModel)
  throw Error('Unexpected NVIDIA QA model');
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
      ...(provider==='groq'?{GROQ_API_KEY:token,GROQ_MODEL:qaModel}:
        {NVIDIA_API_KEY:token,NVIDIA_MODEL:qaModel}),
      AI_PRIMARY_PROVIDER:provider,
      AI_FALLBACK_ENABLED:'false',
      AI_REQUEST_TIMEOUT_MS:'30000'
    }
  });
  // Only numerical metrics from a wholly synthetic QA brief and public data.
  // Never expose provider responses, prompts or tokens in routine server logs.
  if(answer?.text){
    try{
      const j=JSON.parse(answer.text);
      console.log('REAL_AI_ACCEPTANCE model-choice-count='+
        (Array.isArray(j?.choices)?j.choices.length:'not-json-choices'));
      if(Array.isArray(j?.choices))console.log('REAL_AI_ACCEPTANCE proposed-fit-scores='+
        JSON.stringify(j.choices.map(x=>x.fit).filter(Number.isInteger)));
    }catch{console.log('REAL_AI_ACCEPTANCE output=not-strict-json')}
  }
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
