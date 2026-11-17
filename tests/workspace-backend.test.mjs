import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('10C owner-scoped workspace dashboard, download, pagination and full erasure',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+server.address().port;
  const cookies=['',''];
  const call=async(i,path,method='GET',data)=>{
    const headers={};
    if(cookies[i])headers.Cookie=cookies[i];
    if(data!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(host+path,{method,headers,
      body:data===undefined?undefined:JSON.stringify(data)});
    const cookie=response.headers.get('set-cookie');
    if(cookie)cookies[i]=cookie.split(';')[0];
    return {status:response.status,headers:response.headers,body:await response.json()};
  };
  try{
    const first=await call(0,'/api/projects','POST',{brief:'Design a new accessible school library with robust search filters and student borrowing history.'});
    const second=await call(0,'/api/projects','POST',{brief:'Plan a mobile banking interface with payments, alerts, savings and accessibility.'});
    const outsider=await call(1,'/api/projects','POST',{brief:'Create a visually rich wellness and nutrition tracking dashboard for a fitness club.'});
    assert.equal(first.status,201);assert.equal(second.status,201);assert.equal(outsider.status,201);
    const feedback=await call(0,'/api/feedback','POST',{projectId:first.body.project.id,
      styles:['minimal'],reaction:'like',detail:'Readable component hierarchy'});
    assert.equal(feedback.status,200);
    const overview=await call(0,'/api/workspace/overview');
    assert.equal(overview.status,200);
    assert.deepEqual({identity:overview.body.identity,projectCount:overview.body.projectCount,
      feedbackCount:overview.body.feedbackCount},{identity:'guest',projectCount:2,feedbackCount:1});
    assert.equal((await call(1,'/api/workspace/overview')).body.projectCount,1);
    const listing=await call(0,'/api/projects');
    assert.equal(listing.body.projects.length,2);
    assert.equal(listing.body.nextOffset,null);
    for(const p of listing.body.projects){
      assert.equal(typeof p.messageCount,'number');
      assert.equal(typeof p.promptCount,'number');
      assert.equal(typeof p.inspirationCount,'number');
      assert.ok(p.updatedAt,'History exposes last activity timestamps');
    }
    const subset=await call(0,'/api/projects?offset=1');
    assert.equal(subset.body.projects.length,1);
    assert.equal((await call(0,'/api/projects?offset=not-a-number')).status,400);
    assert.equal((await call(0,'/api/projects?offset=-1')).status,400);
    const exported=await call(0,'/api/workspace/export');
    assert.equal(exported.status,200);
    assert.equal(exported.body.identity,'guest');
    assert.equal(exported.body.projects.length,2);
    assert.ok(exported.body.projects.some(p=>p.id===first.body.project.id));
    assert.ok(exported.body.feedback.some(v=>v.detail==='Readable component hierarchy'));
    assert.ok(!exported.body.projects.some(p=>p.id===outsider.body.project.id),
      'Private account export must never reveal other visitors');
    assert.ok(!JSON.stringify(exported.body).includes('refresh_token'),
      'Account export must never contain Google authentication secrets');
    const outsiderExport=await call(1,'/api/workspace/export');
    assert.equal(outsiderExport.body.projects.length,1);
    assert.ok(outsiderExport.body.projects.every(p=>p.id===outsider.body.project.id));
    const deleted=await call(0,'/api/profile','DELETE');
    assert.equal(deleted.status,200);
    const after=await call(0,'/api/workspace/overview');
    assert.equal(after.body.projectCount,0);
    assert.equal(after.body.feedbackCount,0);
    assert.equal((await call(0,'/api/workspace/export')).body.projects.length,0);
    assert.equal((await call(1,'/api/workspace/overview')).body.projectCount,1,
      'Deleting own history must not affect another visitor');
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
