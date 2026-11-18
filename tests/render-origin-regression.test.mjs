import test from 'node:test';
import assert from 'node:assert/strict';

test('10D Render build accepts local same-origin tests, but rejects cross-origin writes in production',async()=>{
  const saved={
    RENDER_SERVICE_ID:process.env.RENDER_SERVICE_ID,
    NODE_ENV:process.env.NODE_ENV,
    FRONTLINE_SITE_URL:process.env.FRONTLINE_SITE_URL
  };
  process.env.RENDER_SERVICE_ID='srv-render-build-regression';
  process.env.NODE_ENV='test';
  process.env.FRONTLINE_SITE_URL='https://ui-compass-studio.onrender.com';
  const {server}=await import('../server.mjs?render-origin-regression');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const first=await fetch(origin+'/api/profile');
    const cookie=first.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie,'Test guest must receive a cookie');
    const body=JSON.stringify({brief:'Create a responsive patient appointment planner with medication reminders and clear typography.'});
    const post=(requestOrigin)=>fetch(origin+'/api/projects',{
      method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:requestOrigin},
      body
    });
    assert.equal((await post(origin)).status,201,
      'Render builds with NODE_ENV=test must allow their own isolated localhost requests');
    assert.equal((await post('https://attacker.invalid')).status,403,
      'Even local test mode must reject an unrelated origin');
    process.env.NODE_ENV='production';
    assert.equal((await post(origin)).status,403,
      'Live Render requests must require the explicitly configured HTTPS origin');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    for(const [key,value] of Object.entries(saved)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
