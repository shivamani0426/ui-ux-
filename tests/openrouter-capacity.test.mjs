import test from 'node:test';
import assert from 'node:assert/strict';
import {designAiReply} from '../ai-providers.mjs';

const env={OPENROUTER_API_KEY:'qa-fake-key',OPENROUTER_MODEL:'openrouter/free',
  AI_PRIMARY_PROVIDER:'openrouter',AI_FALLBACK_ENABLED:'false'};
const brief='An equipment reservation calendar and workshop repair system';
const catalog='0 | application-ui | Screenrove | Booking Calendar | Real available slots and a reservation list';
const rejected=(source,reset)=>new Response(JSON.stringify({error:{
  message:'private upstream message that must never reach logs',
  metadata:{limit_source:source}
}}),{status:429,headers:{'content-type':'application/json',
  ...(reset?{'x-ratelimit-reset':String(reset)}:{})}});

test('OpenRouter free-tier 429 obeys the actual reset time, sends no retry and does not leak details',async()=>{
  let calls=0;const notices=[];const logs=[];const original=console.warn;
  console.warn=(...args)=>logs.push(args.join(' '));
  try{
    const result=await designAiReply({brief,task:'source-evaluate',sourceCatalog:catalog,
      messages:[],env,onFailure:e=>notices.push(e),
      request:async()=>{calls++;return rejected('openrouter_free_tier_per_minute',Date.now()+100000)}});
    assert.equal(result,null);
    assert.equal(calls,1);
    assert.equal(notices[0].reason,'rate-limited');
    assert.ok(notices[0].retryAfterSeconds>=90&&notices[0].retryAfterSeconds<=110);
    assert.match(logs.join(' '),/free-minute-limit/);
    assert.doesNotMatch(logs.join(' '),/private upstream message|qa-fake-key/);
  }finally{console.warn=original}
});
test('Untrusted rate-limit metadata never enters logs or retries as a different provider',async()=>{
  const logs=[];const original=console.warn;console.warn=(...args)=>logs.push(args.join(' '));
  try{
    let calls=0;
    const result=await designAiReply({brief,task:'source-evaluate',sourceCatalog:catalog,
      env,request:async()=>{calls++;return rejected('unknown\nsecret-token') }});
    assert.equal(result,null);assert.equal(calls,1);
    assert.doesNotMatch(logs.join(' '),/secret-token|unknown/);
  }finally{console.warn=original}
});
test('Source evaluation preserves a larger bounded visible-output budget on free router',async()=>{
  let payload;
  const response=await designAiReply({brief,task:'source-evaluate',sourceCatalog:catalog,
    env,request:async(_url,init)=>{
      payload=JSON.parse(init.body);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',
        message:{content:'{"choices":[{"index":0,"fit":5,"reason":"Original calendar supports concrete booking availability."}]}'}}]}),
        {status:200,headers:{'content-type':'application/json'}});
    }});
  assert.ok(response?.text?.includes('booking availability'));
  assert.equal(payload.model,'openrouter/free');
  assert.equal(payload.max_tokens,1750);
  assert.equal(payload.reasoning.effort,'low');
});
