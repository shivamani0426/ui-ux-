import test from 'node:test';
import assert from 'node:assert/strict';
import {aiConfig,designAiReply} from '../ai-providers.mjs';

const brief='Design an original student learning dashboard with readable navigation';
const messages=[
  {role:'user',content:'Create a friendly layout'},
  {role:'assistant',content:'Start with a clear sidebar'},
  {role:'user',content:'Use a calming blue color system'},
];
const styles=[{name:'Minimal SaaS'},{name:'Glass UI'}];
const response=(status,payload)=>({ok:status>=200&&status<300,status,json:async()=>payload});
const geminiOk=text=>response(200,{candidates:[{content:{parts:[{text}]}}]});
const openRouterOk=text=>response(200,{choices:[{message:{content:text}}]});

test('Provider configuration never exposes keys, and no key means no network access',async()=>{
  const env={GEMINI_API_KEY:'super-private-123',OPENROUTER_API_KEY:'another-private-789',GROQ_API_KEY:'groq-private-456',AI_FALLBACK_ENABLED:'true'};
  const config=aiConfig(env);
  assert.deepEqual(config,{aiEnabled:true,aiProviders:{gemini:true,openrouter:true,groq:true},aiPrimary:'openrouter',aiFallbackProvider:'groq',aiFallbackEnabled:true,aiStatus:'configured-unverified'});
  assert.ok(!JSON.stringify(config).includes('private'));
  assert.deepEqual(aiConfig({}),{aiEnabled:false,aiProviders:{gemini:false,openrouter:false,groq:false},aiPrimary:'openrouter',aiFallbackProvider:'groq',aiFallbackEnabled:false,aiStatus:'not-configured'});
  let calls=0;
  const out=await designAiReply({brief,messages,env:{},request:()=>{calls++;throw Error('must not run')}});
  assert.equal(out,null);
  assert.equal(calls,0);
});

test('Gemini receives server-only key, original project brief and role-mapped conversation',async()=>{
  const calls=[];
  const env={GEMINI_API_KEY:'gemini-test-secret',OPENROUTER_API_KEY:'backup-secret',AI_PRIMARY_PROVIDER:'gemini'};
  const answer=await designAiReply({brief,messages,styles,env,request:async(url,init)=>{
    calls.push({url,init});
    return geminiOk('A structured original blue student dashboard with accessible navigation.');
  }});
  assert.equal(answer.source,'ai');
  assert.equal(answer.provider,'gemini');
  assert.equal(calls.length,1,'OpenRouter should not receive user content when Gemini succeeds');
  assert.ok(calls[0].url.endsWith('/gemini-3.5-flash-lite:generateContent'));
  assert.equal(calls[0].init.headers['x-goog-api-key'],'gemini-test-secret');
  assert.ok(!JSON.stringify(calls[0].init.body).includes('gemini-test-secret'));
  const body=JSON.parse(calls[0].init.body);
  assert.doesNotMatch(body.systemInstruction.parts[0].text,/student learning dashboard/,
    'Untrusted user brief must not be elevated to system instructions');
  assert.match(body.contents[0].parts[0].text,/student learning dashboard/);
  assert.match(body.contents[0].parts[0].text,/Minimal SaaS/);
  assert.deepEqual(body.contents.map(x=>x.role),['user','model','user']);
  assert.equal(body.contents[2].parts[0].text,'Use a calming blue color system');
  assert.equal(body.generationConfig.maxOutputTokens,1100);
});

test('OpenRouter gets same project when Gemini fails, only with explicit fallback permission',async()=>{
  const calls=[];
  const env={GEMINI_API_KEY:'gemini-key',OPENROUTER_API_KEY:'openrouter-key',AI_PRIMARY_PROVIDER:'gemini',AI_FALLBACK_ENABLED:'true'};
  const answer=await designAiReply({brief,messages,styles,env,request:async(url,init)=>{
    calls.push({url,init});
    return url.includes('generativelanguage.googleapis.com')
      ?response(429,{error:'quota exceeded'}):openRouterOk('Start with a flexible dashboard grid.');
  }});
  assert.equal(answer.provider,'openrouter');
  assert.deepEqual(calls.map(x=>new URL(x.url).host),['generativelanguage.googleapis.com','openrouter.ai']);
  assert.equal(calls[1].init.headers.Authorization,'Bearer openrouter-key');
  const body=JSON.parse(calls[1].init.body);
  assert.equal(body.model,'openrouter/free');
  assert.match(body.messages[0].content,/original/);
  assert.equal(body.messages.at(-1).content,'Use a calming blue color system');
});

test('Do not share a private prompt with a second provider unless operator opted in',async()=>{
  let calls=0;
  const answer=await designAiReply({
    brief,messages,env:{GEMINI_API_KEY:'gemini-key',OPENROUTER_API_KEY:'backup-key',AI_PRIMARY_PROVIDER:'gemini'},
    request:async()=>{calls++;return response(503,{error:'unavailable'})},
  });
  assert.equal(answer,null);
  assert.equal(calls,1);
});

test('OpenRouter-only setup continues to work without Gemini credentials',async()=>{
  let seen;
  const answer=await designAiReply({
    brief,messages,
    env:{OPENROUTER_API_KEY:'openrouter-key',OPENROUTER_MODEL:'openrouter/free'},
    request:async(url,init)=>{seen={url,init};return openRouterOk('A clear and usable original experience.')},
  });
  assert.equal(answer.provider,'openrouter');
  assert.equal(new URL(seen.url).host,'openrouter.ai');
});

test('Provider order can be reversed without dropping Gemini failover',async()=>{
  const calls=[];
  const answer=await designAiReply({
    brief,messages,env:{AI_PRIMARY_PROVIDER:'openrouter',AI_FALLBACK_PROVIDER:'gemini',AI_FALLBACK_ENABLED:'true',GEMINI_API_KEY:'gemini',OPENROUTER_API_KEY:'openrouter'},
    request:async(url)=>{calls.push(url);return url.includes('openrouter.ai')?response(502,{}):geminiOk('A useful result from Gemini')},
  });
  assert.equal(answer.provider,'gemini');
  assert.equal(calls.length,2);
});

test('Unsuccessful or empty provider responses leave the deterministic guide available',async()=>{
  const result=await designAiReply({brief,messages,
    env:{GEMINI_API_KEY:'test',AI_PRIMARY_PROVIDER:'gemini'},request:async()=>response(200,{candidates:[{finishReason:'SAFETY'}]})});
  assert.equal(result,null);
});

test('Prompt-only task requests longer design output, not application code',async()=>{
  const env={GEMINI_API_KEY:'not-a-real-key',AI_PRIMARY_PROVIDER:'gemini'};
  let payload;
  const answer=await designAiReply({brief,messages,styles,task:'prompt',env,request:async(url,init)=>{
    payload=JSON.parse(init.body);
    return geminiOk('A sufficiently detailed original UI/UX prompt '.repeat(20));
  }});
  assert.equal(answer.provider,'gemini');
  assert.equal(payload.generationConfig.maxOutputTokens,3600);
  assert.match(payload.systemInstruction.parts[0].text,/No actual application code/i);
});
test('Latest model configuration is still overridable with a safe model ID',async()=>{
  let url;
  await designAiReply({brief,messages,env:{GEMINI_API_KEY:'test',GEMINI_MODEL:'gemini-3.8-flash',AI_PRIMARY_PROVIDER:'gemini'},request:async(u)=>{
    url=u;return geminiOk('A clear design');
  }});
  assert.ok(url.endsWith('/gemini-3.8-flash:generateContent'));
});

test('HTTP 400 Gemini diagnostics expose only safe status and known class, never upstream details',async()=>{
  const env={GEMINI_API_KEY:'secret-not-for-logs',AI_PRIMARY_PROVIDER:'gemini'};
  const logged=[];
  const original=console.warn;console.warn=(...args)=>logged.push(args.join(' '));
  try{
    const answer=await designAiReply({brief,messages,env,request:async()=>response(400,{
      error:{code:400,status:'FAILED_PRECONDITION',message:'Gemini API free tier is not available in your country. Secret secret-not-for-logs',
        details:[{reason:'FREE_TIER_REGION_RESTRICTED'}]}
    })});
    assert.equal(answer,null);
    assert.match(logged[0],/gemini HTTP 400 FAILED_PRECONDITION FREE_TIER_REGION_RESTRICTED free-tier-region/);
    assert.ok(!logged[0].includes('secret-not-for-logs'));
    assert.ok(!logged[0].includes('free tier is not available in your country'));
  }finally{console.warn=original}
});
test('OpenRouter alternate content parts and safe network diagnosis',async()=>{
  const env={OPENROUTER_API_KEY:'private-key',AI_PRIMARY_PROVIDER:'openrouter'};
  const answer=await designAiReply({brief,messages,env,request:async()=>response(200,{
    choices:[{message:{content:[{type:'text',text:'An original usable design'}]}}]
  })});
  assert.equal(answer.text,'An original usable design');
  const logged=[];const original=console.warn;console.warn=(...args)=>logged.push(args.join(' '));
  try{
    const failed=await designAiReply({brief,messages,env,request:async()=>{const e=new TypeError('some private server message');e.cause={code:'ECONNRESET'};throw e}});
    assert.equal(failed,null);assert.match(logged[0],/network ECONNRESET/);
    assert.ok(!logged[0].includes('some private'));
  }finally{console.warn=original}
});

test('OpenRouter first, Groq backup: success does not share prompt with Groq or Gemini',async()=>{
  const urls=[];
  const env={OPENROUTER_API_KEY:'primary-key',GROQ_API_KEY:'backup-key',
    GEMINI_API_KEY:'unavailable-google-key',AI_PRIMARY_PROVIDER:'openrouter',
    AI_FALLBACK_PROVIDER:'groq',AI_FALLBACK_ENABLED:'true'};
  const answer=await designAiReply({brief,messages,styles,env,request:async(url,init)=>{
    urls.push(url);return openRouterOk('An accessible original dashboard');
  }});
  assert.equal(answer.source,'ai');
  assert.equal(answer.provider,'openrouter');
  assert.equal(urls.length,1);
  assert.ok(urls[0].includes('openrouter.ai'));
  const config=aiConfig(env);
  assert.equal(config.aiPrimary,'openrouter');
  assert.equal(config.aiFallbackProvider,'groq');
  assert.equal(config.aiProviders.groq,true);
  assert.ok(!JSON.stringify(config).includes('backup-key'));
});

test('Groq receives a brief only if enabled backup after OpenRouter failure',async()=>{
  const calls=[];
  const env={OPENROUTER_API_KEY:'primary-secret',GROQ_API_KEY:'groq-secret',
    GEMINI_API_KEY:'unused-gemini-secret',AI_PRIMARY_PROVIDER:'openrouter',
    AI_FALLBACK_PROVIDER:'groq',AI_FALLBACK_ENABLED:'true'};
  const answer=await designAiReply({brief,messages,styles,env,request:async(url,init)=>{
    calls.push({url,init});
    return url.includes('openrouter.ai')?response(503,{error:'Unavailable'}):
      openRouterOk('Groq generated an original design response');
  }});
  assert.equal(answer.provider,'groq');
  assert.equal(answer.text,'Groq generated an original design response');
  assert.deepEqual(calls.map(x=>new URL(x.url).host),['openrouter.ai','api.groq.com']);
  assert.equal(calls[1].init.headers.Authorization,'Bearer groq-secret');
  assert.ok(!calls[1].init.body.includes('groq-secret'));
  const body=JSON.parse(calls[1].init.body);
  assert.equal(body.model,'openai/gpt-oss-20b');
  assert.equal(body.max_completion_tokens,1100);
  assert.equal(body.reasoning_effort,'low');
  assert.equal(body.include_reasoning,false);
  assert.equal(body.messages.at(-1).content,'Use a calming blue color system');
});

test('Groq backup never receives user content when fallback is disabled',async()=>{
  const requests=[];
  const result=await designAiReply({brief,messages,env:{
    OPENROUTER_API_KEY:'primary',GROQ_API_KEY:'groq',
    AI_PRIMARY_PROVIDER:'openrouter',AI_FALLBACK_PROVIDER:'groq',AI_FALLBACK_ENABLED:'false'
  },request:async url=>{requests.push(url);return response(429,{})}});
  assert.equal(result,null);
  assert.deepEqual(requests.map(url=>new URL(url).host),['openrouter.ai']);
});

test('Groq-only configuration can respond when OpenRouter key is not yet installed',async()=>{
  const calls=[];
  const result=await designAiReply({brief,messages,env:{
    GROQ_API_KEY:'groq-only',AI_PRIMARY_PROVIDER:'openrouter',
    AI_FALLBACK_PROVIDER:'groq',AI_FALLBACK_ENABLED:'false'
  },request:async(url,init)=>{calls.push({url,init});return openRouterOk('Groq standalone works')}});
  assert.equal(result.provider,'groq');
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).host,'api.groq.com');
});

test('Groq prompt-only mode uses longer budget and supports provider status errors',async()=>{
  const urls=[];
  const logs=[];
  const originalWarn=console.warn;
  console.warn=(...args)=>logs.push(args.join(' '));
  try{
    const answer=await designAiReply({brief,messages,task:'prompt',env:{
      GROQ_API_KEY:'test-secret',AI_PRIMARY_PROVIDER:'groq',GROQ_MODEL:'openai/gpt-oss-20b'
    },request:async(url,init)=>{urls.push({url,body:JSON.parse(init.body)});
      return openRouterOk('Detailed original UI/UX specification '.repeat(30));
    }});
    assert.equal(answer.provider,'groq');
    assert.equal(urls[0].body.max_completion_tokens,5200);
    assert.match(urls[0].body.messages[0].content,/No actual application code/i);
    const failed=await designAiReply({brief,messages,env:{
      GROQ_API_KEY:'test-secret',AI_PRIMARY_PROVIDER:'groq'
    },request:async()=>response(401,{error:{code:'invalid_api_key',message:'secret should not show'}})});
    assert.equal(failed,null);
    assert.match(logs[0],/groq HTTP 401/);
    assert.ok(!logs[0].includes('secret should not show'));
  }finally{console.warn=originalWarn}
});
