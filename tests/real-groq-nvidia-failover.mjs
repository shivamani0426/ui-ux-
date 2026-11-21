/**
 * Actual live NVIDIA fallback against genuine publisher sources, with only
 * the primary Groq outage simulated. Synthetic public brief; no user data.
 * Never directly prints provider-generated text or any credential.
 */
import assert from 'node:assert/strict';
import {designAiReply} from '../ai-providers.mjs';
import {searchScreenroveReferences} from '../screenrove-publisher.mjs';
import {evaluatePublisherSources,clearPublisherEvaluationCacheForTests}
  from '../publisher-semantic-evaluation.mjs';
if(process.env.FRONTLINE_PROVIDER_FAILOVER_ACCEPTANCE!=='1')
  throw Error('Explicit live failover acceptance flag required');
if(!process.env.GROQ_API_KEY||!process.env.NVIDIA_API_KEY)
  throw Error('FAILOVER_BLOCKED missing Groq or NVIDIA Actions secret');
const brief='Design a shared equipment booking and inspection application for public workshop administrators. '+
  'Members reserve available time slots, check booking calendars and view equipment status. '+
  'Staff maintain inventory records and track repair requests. The interface must be accessible.';
const discovered=await searchScreenroveReferences({appQuery:'booking calendar',
  appQueries:['inventory management'],brief},{candidateMode:true,limitPerKind:5});
const verified=(discovered.matches||[]).filter(x=>x.publisherVerified===true);
assert.ok(verified.length>0,'No genuine publisher candidates available');
const network={primary:0,backup:0};
const request=async(url,options)=>{
  if(url==='https://api.groq.com/openai/v1/chat/completions'){
    network.primary++;
    return new Response(JSON.stringify({error:{message:'simulated QA outage'}}),
      {status:503,headers:{'Content-Type':'application/json'}});
  }
  if(url==='https://integrate.api.nvidia.com/v1/chat/completions'){
    network.backup++;
    return fetch(url,options);
  }
  throw Error('Unexpected remote inference host');
};
clearPublisherEvaluationCacheForTests();
const evaluated=await evaluatePublisherSources(brief,verified,{model:async({brief:goal,sourceCatalog})=>{
  return designAiReply({brief:goal,sourceCatalog,task:'source-evaluate',messages:[],
    request,env:{
      GROQ_API_KEY:process.env.GROQ_API_KEY,
      NVIDIA_API_KEY:process.env.NVIDIA_API_KEY,
      NVIDIA_MODEL:'nvidia/nemotron-3.5-lightning-30b-a3b',
      AI_PRIMARY_PROVIDER:'groq',AI_FALLBACK_PROVIDER:'nvidia',
      AI_FALLBACK_ENABLED:'true'
    }});
}});
const chosen=[...evaluated.applicationMatches,...evaluated.landingMatches];
console.log('LIVE_FAILOVER simulated-primary-failures='+network.primary+
  ' actual-nvidia-calls='+network.backup+' publisher-verified='+verified.length+
  ' semantic-status='+evaluated.status+' matches='+chosen.length);
assert.equal(network.primary,1,'Primary must be attempted exactly once');
assert.equal(network.backup,1,'Only one authorized NVIDIA backup call');
assert.equal(evaluated.status,'semantic-evaluated','Fallback must deliver genuine JSON semantic review');
assert.ok(chosen.length>0,'Genuine model must select a relevant original source');
assert.ok(chosen.every(x=>x.publisherVerified===true&&x.matchReason?.length>=24),
  'Fallback suggestions must be independently grounded');
let unauthorized=0;
const blocked=await designAiReply({brief,task:'source-evaluate',sourceCatalog:'test',
  env:{GROQ_API_KEY:'fictional',NVIDIA_API_KEY:'fictional',
    AI_PRIMARY_PROVIDER:'groq',AI_FALLBACK_PROVIDER:'nvidia',AI_FALLBACK_ENABLED:'false'},
  request:async url=>{
    if(url.includes('nvidia.com'))unauthorized++;
    return new Response('{}',{status:503,headers:{'Content-Type':'application/json'}});
  }});
assert.equal(blocked,null);
assert.equal(unauthorized,0,'Never share prompt without explicit operator permission');
console.log('LIVE_FAILOVER PASSED genuine-NVIDIA-relevance-and-opt-in-privacy');
