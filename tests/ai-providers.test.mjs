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
  const env={GEMINI_API_KEY:'super-private-123',OPENROUTER_API_KEY:'another-private-789',AI_FALLBACK_ENABLED:'true'};
  const config=aiConfig(env);
  assert.deepEqual(config,{aiEnabled:true,aiProviders:{gemini:true,openrouter:true},aiPrimary:'gemini',aiFallbackEnabled:true,aiStatus:'configured-unverified'});
  assert.ok(!JSON.stringify(config).includes('private'));
  assert.deepEqual(aiConfig({}),{aiEnabled:false,aiProviders:{gemini:false,openrouter:false},aiPrimary:'gemini',aiFallbackEnabled:false,aiStatus:'not-configured'});
  let calls=0;
  const out=await designAiReply({brief,messages,env:{},request:()=>{calls++;throw Error('must not run')}});
  assert.equal(out,null);
  assert.equal(calls,0);
});

test('Gemini receives server-only key, original project brief and role-mapped conversation',async()=>{
  const calls=[];
  const env={GEMINI_API_KEY:'gemini-test-secret',OPENROUTER_API_KEY:'backup-secret'};
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
  const env={GEMINI_API_KEY:'gemini-key',OPENROUTER_API_KEY:'openrouter-key',AI_FALLBACK_ENABLED:'true'};
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
    brief,messages,env:{GEMINI_API_KEY:'gemini-key',OPENROUTER_API_KEY:'backup-key'},
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
    brief,messages,env:{AI_PRIMARY_PROVIDER:'openrouter',AI_FALLBACK_ENABLED:'true',GEMINI_API_KEY:'gemini',OPENROUTER_API_KEY:'openrouter'},
    request:async(url)=>{calls.push(url);return url.includes('openrouter.ai')?response(502,{}):geminiOk('A useful result from Gemini')},
  });
  assert.equal(answer.provider,'gemini');
  assert.equal(calls.length,2);
});

test('Unsuccessful or empty provider responses leave the deterministic guide available',async()=>{
  const result=await designAiReply({brief,messages,
    env:{GEMINI_API_KEY:'test'},request:async()=>response(200,{candidates:[{finishReason:'SAFETY'}]})});
  assert.equal(result,null);
});

test('Prompt-only task requests longer design output, not application code',async()=>{
  const env={GEMINI_API_KEY:'not-a-real-key'};
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
  await designAiReply({brief,messages,env:{GEMINI_API_KEY:'test',GEMINI_MODEL:'gemini-3.8-flash'},request:async(u)=>{
    url=u;return geminiOk('A clear design');
  }});
  assert.ok(url.endsWith('/gemini-3.8-flash:generateContent'));
});
