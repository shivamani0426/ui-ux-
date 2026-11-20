import test from 'node:test';
import assert from 'node:assert/strict';
import {designAiReply} from '../ai-providers.mjs';
import {parsePublisherEvaluation,publisherCandidateCatalog} from '../publisher-semantic-evaluation.mjs';

const candidates=[
  {id:'source1',provider:'Screenrove',publisherVerified:true,designType:'application-ui',
    name:'Fleet planning overview',
    site:'https://screenrove.com/fleet/product/dispatch',
    summary:'A calendar and task queue for routing vehicles'},
  {id:'source2',provider:'Screenrove',publisherVerified:true,designType:'landing-page',
    name:'Community transport overview',
    site:'https://screenrove.com/fleet/marketing/transport',
    summary:'A service-benefits page with clear calls to action'}
];
const brief='Design a public school transport scheduling application with route management and daily parent notifications.';
const responseText=JSON.stringify({choices:[{index:0,fit:5,
  reason:'The observed dispatch calendar can serve scheduling and route-review tasks.'}]});
for(const provider of ['openrouter','gemini','groq']){
  test('source-evaluate runs as a real structured AI task through '+provider+' adapter (mock transport)',async()=>{
    const env={
      AI_PRIMARY_PROVIDER:provider,AI_FALLBACK_ENABLED:'false',
      ...(provider==='openrouter'?{OPENROUTER_API_KEY:'test-key',OPENROUTER_MODEL:'openrouter/free'}:
        provider==='gemini'?{GEMINI_API_KEY:'test-key',GEMINI_MODEL:'gemini-3.5-flash-lite'}:
        {GROQ_API_KEY:'test-key',GROQ_MODEL:'openai/gpt-oss-20b'})
    };
    let networkCount=0;
    const request=async(url,options)=>{
      networkCount++;
      const body=JSON.parse(options.body);
      let sys='',user='';
      if(provider==='gemini'){
        assert.match(url,/generativelanguage.googleapis.com/);
        sys=body.systemInstruction.parts[0].text;
        user=body.contents[0].parts[0].text;
      }else{
        assert.match(url,provider==='openrouter'?/openrouter.ai/:/api.groq.com/);
        sys=body.messages[0].content;user=body.messages[1].content;
      }
      assert.match(sys,/genuinely transferable interaction|genuinely applicable|functional suitability|transferable/i);
      assert.match(sys,/publisher/i);
      assert.match(user,/school transport scheduling/);
      assert.match(user,/Fleet planning overview/);
      assert.doesNotMatch(user,/https:\/\/screenrove.com/);
      assert.ok(body.generationConfig?.maxOutputTokens>=1000||
        (body.max_tokens||body.max_completion_tokens)>=1000);
      return new Response(JSON.stringify(provider==='gemini'
        ?{candidates:[{content:{parts:[{text:responseText}]}}]}
        :{choices:[{message:{content:responseText},finish_reason:'stop'}]}
      ),{status:200,headers:{'Content-Type':'application/json'}});
    };
    const answer=await designAiReply({
      brief,task:'source-evaluate',messages:[],styles:[],env,request,
      sourceCatalog:publisherCandidateCatalog(candidates)
    });
    assert.equal(networkCount,1);
    assert.equal(answer?.source,'ai');
    assert.equal(answer?.provider,provider);
    const parsed=parsePublisherEvaluation(answer,candidates,{brief});
    assert.deepEqual(parsed.applicationMatches.map(x=>x.id),['source1']);
    assert.deepEqual(parsed.landingMatches,[]);
  });
}
test('late requirements survive full source-evaluation prompt and model cannot invent candidates',async()=>{
  const long=brief+' '+('The mobile dashboard must remain easy to navigate. '.repeat(90))+
    'The critical final requirement is offline route checkpoint review.';
  let last='';
  const answer=await designAiReply({
    brief:long,task:'source-evaluate',messages:[],styles:[],
    sourceCatalog:publisherCandidateCatalog(candidates),
    env:{OPENROUTER_API_KEY:'test-key',AI_PRIMARY_PROVIDER:'openrouter',
      OPENROUTER_MODEL:'openrouter/free'},
    request:async(_url,options)=>{
      last=JSON.parse(options.body).messages[1].content;
      return new Response(JSON.stringify({choices:[{message:{content:'{"choices":[]}'},
        finish_reason:'stop'}]}),{status:200});
    }
  });
  assert.match(last,/critical final requirement is offline route checkpoint review/);
  assert.deepEqual(parsePublisherEvaluation(answer,candidates,{brief:long}).applicationMatches,[]);
});
