import test from 'node:test';
import assert from 'node:assert/strict';

test('Verified OAuth account claims guest data, retains it on refresh, and isolates other guests',async()=>{
  const originalFetch=globalThis.fetch;
  const prior={
    FRONTLINE_SUPABASE_URL:process.env.FRONTLINE_SUPABASE_URL,
    FRONTLINE_SUPABASE_PUBLISHABLE_KEY:process.env.FRONTLINE_SUPABASE_PUBLISHABLE_KEY,
    FRONTLINE_SITE_URL:process.env.FRONTLINE_SITE_URL,
    FRONTLINE_GOOGLE_LOGIN_ENABLED:process.env.FRONTLINE_GOOGLE_LOGIN_ENABLED
  };
  process.env.FRONTLINE_SUPABASE_URL='https://example.supabase.co';
  process.env.FRONTLINE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test_frontline_signin_123456';
  process.env.FRONTLINE_SITE_URL='http://127.0.0.1:3000';
  process.env.FRONTLINE_GOOGLE_LOGIN_ENABLED='true';
  const account='11111111-1111-4111-8111-111111111111';
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    if(String(url).startsWith('https://example.supabase.co/auth/v1/')){
      calls.push({url:String(url),method:options.method||'GET'});
      if(String(url).includes('/token?grant_type=pkce'))
        return new Response(JSON.stringify({access_token:'valid-account-access',refresh_token:'valid-account-refresh',expires_in:3600}),{status:200});
      if(String(url).endsWith('/user')){
        assert.equal(options.headers.Authorization,'Bearer valid-account-access');
        return new Response(JSON.stringify({id:account,email:'designer@example.test',user_metadata:{full_name:'Test designer'}}),{status:200});
      }
      if(String(url).endsWith('/logout'))return new Response('',{status:200});
      throw Error('Unexpected token request');
    }
    return originalFetch(url,options);
  };
  const {server}=await import('../server.mjs?oauth-account-integration');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const call=(path,opts={})=>originalFetch(base+path,{redirect:'manual',...opts});
  const setCookie=r=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  try{
    const status=await call('/api/auth/status');
    assert.equal((await status.json()).googleEnabled,true);
    const guest=await call('/api/auth/me');
    const guestCookie=setCookie(guest);
    assert.match(guestCookie,/uic_guest=[a-f0-9-]{36}/);
    const create=await call('/api/projects',{method:'POST',headers:{
      'Content-Type':'application/json',Cookie:guestCookie
    },body:JSON.stringify({brief:'Plan a healthcare dashboard with patient records, caregiver navigation and accessible typography.'})});
    assert.equal(create.status,201);
    const project=(await create.json()).project;
    const start=await call('/auth/google/start',{headers:{Cookie:guestCookie}});
    assert.equal(start.status,303);
    assert.match(start.headers.get('location'),/auth\/v1\/authorize/);
    const pkceCookie=setCookie(start);
    assert.match(pkceCookie,/fl_pkce=/);
    const completed=await call('/auth/callback?code=testing-code',{headers:{
      Cookie:guestCookie+'; '+pkceCookie
    }});
    assert.equal(completed.status,303);
    assert.equal(completed.headers.get('location'),'/studio?auth=connected');
    const accountCookies=setCookie(completed);
    const allCookies=guestCookie+'; '+accountCookies;
    const me=await call('/api/auth/me',{headers:{Cookie:allCookies}});
    const signed=await me.json();
    assert.equal(signed.authenticated,true);
    assert.equal(signed.user.id,account);
    const listed=await call('/api/projects',{headers:{Cookie:allCookies}});
    assert.ok((await listed.json()).projects.some(p=>p.id===project.id));
    const elsewhere=await call('/api/projects/'+project.id);
    assert.equal(elsewhere.status,404,'A different guest must not read migrated projects');
    const logout=await call('/api/auth/logout',{method:'POST',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:'{}'});
    assert.equal(logout.status,200);
    const guestAfter=await call('/api/projects',{headers:{Cookie:guestCookie}});
    assert.equal((await guestAfter.json()).projects.length,0,'Migrated project no longer belongs to the old guest');
    assert.ok(calls.some(c=>c.url.endsWith('/user')),'The server must validate the actual account with Supabase');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    globalThis.fetch=originalFetch;
    for(const [name,value] of Object.entries(prior)){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
