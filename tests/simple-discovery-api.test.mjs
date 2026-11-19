import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('simple chat refuses unsolicited components, respects explicit Yes/No, and persists messages',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const api=async(path,method='GET',body)=>{
    const response=await fetch(origin+path,{
      method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined
    });
    cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
    return {status:response.status,data:await response.json()};
  };
  try{
    const created=await api('/api/projects','POST',{
      brief:'Create a thoughtful school dashboard with attendance and student progress'
    });
    assert.equal(created.status,201);
    const id=created.data.project.id;
    const path='/api/projects/'+id+'/messages';
    const first=await api(path,'POST',{message:'School dashboard inspiration please',styles:[],simpleDiscovery:true});
    assert.equal(first.status,200);
    assert.equal(first.data.messages.at(-1).flowStage,'offer-combination');
    assert.match(first.data.messages.at(-1).content,/Would you like matching original UI components/);
    assert.doesNotMatch(first.data.messages.at(-1).content,/Matching components and animations/);

    const ambiguous=await api(path,'POST',{message:'Sure',styles:[],simpleDiscovery:true});
    assert.equal(ambiguous.status,200);
    assert.equal(ambiguous.data.messages.at(-1).flowStage,'offer-combination');
    assert.match(ambiguous.data.messages.at(-1).content,/Please reply Yes or No/);
    assert.doesNotMatch(ambiguous.data.messages.at(-1).content,/Matching components and animations/);
    const declined=await api(path,'POST',{message:'No thanks',styles:[],simpleDiscovery:true});
    assert.equal(declined.status,200);
    assert.equal(declined.data.messages.at(-1).flowStage,'complete');
    assert.match(declined.data.messages.at(-1).content,/Okay/);
    const saved=await api('/api/projects/'+id);
    assert.equal(saved.status,200);
    assert.equal(saved.data.project.messages.length,6);

    // A detached Yes must not return components. Consent is valid only immediately
    // after the current project has offered the combination step.
    const unsolicited=await api(path,'POST',{message:'Yes',styles:[],simpleDiscovery:true});
    assert.equal(unsolicited.status,200);
    assert.equal(unsolicited.data.messages.at(-1).flowStage,'offer-combination');
    assert.doesNotMatch(unsolicited.data.messages.at(-1).content,/Matching components and animations/);
    const combined=await api(path,'POST',{message:'Yes',styles:[],simpleDiscovery:true});
    assert.equal(combined.status,200);
    assert.equal(combined.data.messages.at(-1).flowStage,'complete');
    assert.match(combined.data.messages.at(-1).content,/Matching components and animations/);
    assert.doesNotMatch(combined.data.messages.at(-1).content,/UI\/UX designs and original prompts/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
